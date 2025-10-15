import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import client from "../db";
import { 
  createRazorpayOrder, 
  verifyRazorpayPayment, 
  getPaymentDetails,
  getOrderDetails,
  PaymentPlan,
  DEFAULT_PLANS
} from "../services/razorpay-service";

interface CreateOrderBody {
  packageId: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface VerifyPaymentBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  packageId: string;
}

interface PaymentQuery {
  userId?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  
  // Initialize default packages in database if they don't exist
  fastify.addHook('onReady', async () => {
    try {
      for (const plan of DEFAULT_PLANS) {
        const existingPlan = await client.query(
          'SELECT package_id FROM public.packages WHERE package_type = $1',
          [plan.package_type]
        );
        
        if (existingPlan.rows.length === 0) {
          await client.query(`
            INSERT INTO public.packages (package_type, name, description, price_inr, price_paisa, features, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            plan.package_type,
            plan.name,
            plan.description,
            plan.price_inr,
            plan.price_paisa,
            JSON.stringify(plan.features),
            true
          ]);
          console.log(`Created default package: ${plan.name}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default packages:', error);
    }
  });

  // Get available payment packages
  fastify.get("/api/payments/packages", async (request, reply) => {
    try {
      const query = `
        SELECT 
          package_id,
          package_type,
          name,
          description,
          price_inr,
          price_paisa,
          features,
          is_active
        FROM public.packages 
        WHERE is_active = true
        ORDER BY price_inr ASC
      `;

      const result = await client.query(query);

      return reply.code(200).send({
        success: true,
        data: result.rows,
      });
    } catch (error: any) {
      console.error("Error fetching payment packages:", error);
      return reply.code(500).send({
        error: "Internal server error",
      });
    }
  });

  // Get existing users (for testing)
  fastify.get("/api/payments/users", async (request, reply) => {
    try {
      const query = `
        SELECT id, email, name, created_at
        FROM public."user" 
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const result = await client.query(query);

      return reply.code(200).send({
        success: true,
        data: result.rows,
      });
    } catch (error: any) {
      console.error("Error fetching users:", error);
      return reply.code(500).send({
        error: "Internal server error",
      });
    }
  });

  // Create payment order
  fastify.post<{ Body: CreateOrderBody }>(
    "/api/payments/create-order",
    async (
      request: FastifyRequest<{ Body: CreateOrderBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { packageId, customerEmail, customerPhone } = request.body;

        // Validate required fields
        if (!packageId) {
          return reply.code(400).send({
            error: "Missing required field: packageId is required",
          });
        }

        // Get package details from database
        const packageQuery = `
          SELECT * FROM public.packages 
          WHERE package_id = $1 AND is_active = true
        `;
        const packageResult = await client.query(packageQuery, [packageId]);

        if (packageResult.rows.length === 0) {
          return reply.code(400).send({
            error: "Invalid or inactive package ID",
          });
        }

        const packageData = packageResult.rows[0] as PaymentPlan;

        // Create Razorpay order
        const order = await createRazorpayOrder({
          packageId,
          customerEmail,
          customerPhone,
        }, packageData);

        // Start database transaction
        await client.query('BEGIN');

        try {
          // Create user_package record without requiring a user (guest order)
          const userPackageQuery = `
            INSERT INTO public.user_packages (
              user_id,
              package_id, 
              razorpay_order_id,
              payment_status,
              package_status,
              payment_amount,
              customer_email,
              customer_phone,
              customer_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING user_package_id
          `;

          const userPackageResult = await client.query(userPackageQuery, [
            null, // user_id is now nullable
            packageId,
            order.id,
            'pending',
            'inactive',
            order.amount,
            customerEmail,
            customerPhone,
            customerEmail ? customerEmail.split('@')[0] : 'Guest Customer', // Extract name from email or use default
          ]);

          const userPackageId = userPackageResult.rows[0].user_package_id;

          // Create payment transaction record
          const transactionQuery = `
            INSERT INTO public.payment_transactions (
              user_package_id,
              razorpay_order_id,
              transaction_type,
              amount,
              currency,
              status
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING transaction_id
          `;

          const transactionResult = await client.query(transactionQuery, [
            userPackageId,
            order.id,
            'payment',
            order.amount,
            'INR',
            'pending',
          ]);

          await client.query('COMMIT');

          return reply.code(200).send({
            success: true,
            data: {
              orderId: order.id,
              amount: order.amount,
              currency: 'INR',
              key: 'rzp_test_RSxmuF1mnX0iYb', // Razorpay key for frontend
              package: packageData,
              userPackageId: userPackageId,
              transactionId: transactionResult.rows[0].transaction_id,
            },
          });

        } catch (dbError) {
          await client.query('ROLLBACK');
          throw dbError;
        }

      } catch (error: any) {
        console.error("Error creating payment order:", error);
        return reply.code(500).send({
          error: error.message || "Failed to create payment order",
        });
      }
    },
  );

  // Verify payment
  fastify.post<{ Body: VerifyPaymentBody }>(
    "/api/payments/verify",
    async (
      request: FastifyRequest<{ Body: VerifyPaymentBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const {
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
          packageId,
        } = request.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !packageId) {
          return reply.code(400).send({
            error: "Missing required payment verification fields",
          });
        }

        // Verify signature
        const isValidSignature = verifyRazorpayPayment({
          razorpay_order_id,
          razorpay_payment_id,
          razorpay_signature,
        });

        if (!isValidSignature) {
          // Update transaction status to failed
          await client.query(`
            UPDATE public.payment_transactions 
            SET status = 'failed' 
            WHERE razorpay_order_id = $1
          `, [razorpay_order_id]);

          return reply.code(400).send({
            error: "Invalid payment signature",
          });
        }

        // Get payment details from Razorpay
        const paymentDetails = await getPaymentDetails(razorpay_payment_id);

        // Start transaction
        await client.query('BEGIN');

        try {
          // Update payment transaction
          const updateTransactionQuery = `
            UPDATE public.payment_transactions 
            SET 
              razorpay_payment_id = $1,
              razorpay_signature = $2,
              status = 'completed',
              razorpay_response = $3
            WHERE razorpay_order_id = $4
            RETURNING *
          `;

          const transactionResult = await client.query(updateTransactionQuery, [
            razorpay_payment_id,
            razorpay_signature,
            JSON.stringify(paymentDetails),
            razorpay_order_id,
          ]);

          if (transactionResult.rows.length === 0) {
            throw new Error('Transaction not found');
          }

          // Update user package to active
          const updateUserPackageQuery = `
            UPDATE public.user_packages 
            SET 
              razorpay_payment_id = $1,
              payment_status = 'completed',
              package_status = 'active',
              activated_at = NOW(),
              expires_at = NOW() + INTERVAL '1 month'
            WHERE razorpay_order_id = $2
            RETURNING *
          `;

          const userPackageResult = await client.query(updateUserPackageQuery, [
            razorpay_payment_id,
            razorpay_order_id,
          ]);

          if (userPackageResult.rows.length === 0) {
            throw new Error('User package not found');
          }

          await client.query('COMMIT');

          return reply.code(200).send({
            success: true,
            message: "Payment verified successfully",
            data: {
              transaction: transactionResult.rows[0],
              userPackage: userPackageResult.rows[0],
              paymentDetails: {
                id: paymentDetails.id,
                amount: paymentDetails.amount,
                currency: paymentDetails.currency,
                method: paymentDetails.method,
                status: paymentDetails.status,
              },
            },
          });

        } catch (transactionError) {
          await client.query('ROLLBACK');
          throw transactionError;
        }

      } catch (error: any) {
        console.error("Error verifying payment:", error);
        return reply.code(500).send({
          error: error.message || "Failed to verify payment",
        });
      }
    },
  );

  // Get user's payment history
  fastify.get<{ Querystring: PaymentQuery }>(
    "/api/payments/history",
    async (
      request: FastifyRequest<{ Querystring: PaymentQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { userId, status, limit = "50", offset = "0" } = request.query;

        if (!userId) {
          return reply.code(400).send({
            error: "userId is required",
          });
        }

        let query = `
          SELECT 
            pt.*,
            up.package_status,
            up.activated_at,
            up.expires_at,
            p.name as package_name,
            p.package_type,
            p.price_inr
          FROM public.payment_transactions pt
          JOIN public.user_packages up ON pt.user_package_id = up.user_package_id
          JOIN public.packages p ON up.package_id = p.package_id
          WHERE up.user_id = $1
        `;

        const params: any[] = [userId];
        let paramCount = 1;

        if (status) {
          paramCount++;
          query += ` AND pt.status = $${paramCount}`;
          params.push(status);
        }

        query += " ORDER BY pt.created_at DESC";
        
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(parseInt(offset));

        const result = await client.query(query, params);

        return reply.code(200).send({
          success: true,
          data: result.rows,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            count: result.rows.length,
          },
        });
      } catch (error: any) {
        console.error("Error fetching payment history:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Get user's current active package
  fastify.get<{ Querystring: { userId: string } }>(
    "/api/payments/subscription",
    async (
      request: FastifyRequest<{ Querystring: { userId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { userId } = request.query;

        if (!userId) {
          return reply.code(400).send({
            error: "userId is required",
          });
        }

        const query = `
          SELECT 
            up.*,
            p.name as package_name,
            p.package_type,
            p.description,
            p.price_inr,
            p.features
          FROM public.user_packages up
          JOIN public.packages p ON up.package_id = p.package_id
          WHERE up.user_id = $1 
            AND up.package_status = 'active' 
            AND up.expires_at > NOW()
          ORDER BY up.activated_at DESC 
          LIMIT 1
        `;

        const result = await client.query(query, [userId]);

        if (result.rows.length === 0) {
          return reply.code(200).send({
            success: true,
            data: null,
            message: "No active subscription found",
          });
        }

        return reply.code(200).send({
          success: true,
          data: result.rows[0],
        });
      } catch (error: any) {
        console.error("Error fetching subscription:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );

  // Cancel subscription (set to expire at current period end)
  fastify.post<{ Body: { userId: string; userPackageId: string } }>(
    "/api/payments/cancel-subscription",
    async (
      request: FastifyRequest<{ Body: { userId: string; userPackageId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { userId, userPackageId } = request.body;

        if (!userId || !userPackageId) {
          return reply.code(400).send({
            error: "userId and userPackageId are required",
          });
        }

        const updateQuery = `
          UPDATE public.user_packages 
          SET package_status = 'cancelled'
          WHERE user_package_id = $1 AND user_id = $2 AND package_status = 'active'
          RETURNING *
        `;

        const result = await client.query(updateQuery, [userPackageId, userId]);

        if (result.rows.length === 0) {
          return reply.code(404).send({
            error: "Active subscription not found or unauthorized",
          });
        }

        return reply.code(200).send({
          success: true,
          message: "Subscription cancelled successfully",
          data: result.rows[0],
        });
      } catch (error: any) {
        console.error("Error cancelling subscription:", error);
        return reply.code(500).send({
          error: "Internal server error",
        });
      }
    },
  );
}