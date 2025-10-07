import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { payuService } from '../services/payu-service';
import { PaymentRequest, PaymentVerificationRequest } from '../types/payment';
import { validatePayUConfig } from '../config/payu';

interface InitiatePaymentBody {
  amount: number;
  productInfo: string;
  firstName: string;
  email: string;
  phone: string;
  orderId?: string;
  successUrl?: string;
  failureUrl?: string;
  userDefined1?: string;
  userDefined2?: string;
  userDefined3?: string;
  userDefined4?: string;
  userDefined5?: string;
}

interface PaymentCallbackBody extends PaymentVerificationRequest {}

async function paymentRoutes(fastify: FastifyInstance) {
  // Validate PayU configuration on startup
  if (!validatePayUConfig()) {
    fastify.log.warn('PayU configuration is invalid. Payment routes will return errors. Please check environment variables.');
  }

  /**
   * POST /api/payment/initiate
   * Initiate a payment with PayU
   */
  fastify.post<{ Body: InitiatePaymentBody }>(
    '/api/payment/initiate',
    {
      schema: {
        body: {
          type: 'object',
          required: ['amount', 'productInfo', 'firstName', 'email', 'phone'],
          properties: {
            amount: { type: 'number', minimum: 1 },
            productInfo: { type: 'string', minLength: 1 },
            firstName: { type: 'string', minLength: 1 },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string', minLength: 10 },
            orderId: { type: 'string' },
            successUrl: { type: 'string', format: 'uri' },
            failureUrl: { type: 'string', format: 'uri' },
            userDefined1: { type: 'string' },
            userDefined2: { type: 'string' },
            userDefined3: { type: 'string' },
            userDefined4: { type: 'string' },
            userDefined5: { type: 'string' }
          }
        }
      }
    },
    async (request: FastifyRequest<{ Body: InitiatePaymentBody }>, reply: FastifyReply) => {
      try {
        // Check PayU configuration before processing
        if (!validatePayUConfig()) {
          return reply.code(500).send({
            success: false,
            message: 'PayU configuration is invalid. Please check environment variables.',
            error: 'PAYU_CONFIG_INVALID'
          });
        }

        const paymentRequest: PaymentRequest = request.body;
        
        const paymentResponse = await payuService.initiatePayment(paymentRequest);
        
        // Log payment initiation (you might want to save this to database)
        fastify.log.info(`Payment initiated: ${paymentResponse.txnid} for amount ${paymentResponse.amount}`);
        
        return reply.code(200).send({
          success: true,
          data: {
            ...paymentResponse,
            paymentUrl: payuService.getPaymentUrl()
          },
          message: 'Payment initiated successfully'
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to initiate payment',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/payment/success
   * Handle successful payment callback from PayU
   */
  fastify.post<{ Body: PaymentCallbackBody }>(
    '/api/payment/success',
    async (request: FastifyRequest<{ Body: PaymentCallbackBody }>, reply: FastifyReply) => {
      try {
        const paymentData = request.body;
        
        const verificationResult = await payuService.verifyPayment(paymentData);
        
        if (verificationResult.isValid && verificationResult.status === 'success') {
          // Log successful payment
          fastify.log.info(`Payment successful: ${verificationResult.transactionId} for amount ${verificationResult.amount}`);
          
          // TODO: Update your database, send confirmation emails, etc.
          // await updatePaymentStatus(verificationResult.transactionId, 'success');
          
          return reply.code(200).send({
            success: true,
            data: verificationResult,
            message: 'Payment verified successfully'
          });
        } else {
          fastify.log.warn(`Payment verification failed: ${verificationResult.transactionId}`);
          
          return reply.code(400).send({
            success: false,
            data: verificationResult,
            message: 'Payment verification failed'
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to process payment success callback',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/payment/failure
   * Handle failed payment callback from PayU
   */
  fastify.post<{ Body: PaymentCallbackBody }>(
    '/api/payment/failure',
    async (request: FastifyRequest<{ Body: PaymentCallbackBody }>, reply: FastifyReply) => {
      try {
        const paymentData = request.body;
        
        const verificationResult = await payuService.verifyPayment(paymentData);
        
        // Log failed payment
        fastify.log.warn(`Payment failed: ${verificationResult.transactionId} for amount ${verificationResult.amount}`);
        
        // TODO: Update your database
        // await updatePaymentStatus(verificationResult.transactionId, 'failed');
        
        return reply.code(200).send({
          success: false,
          data: verificationResult,
          message: 'Payment failed'
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to process payment failure callback',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/payment/webhook
   * Handle PayU webhook notifications
   */
  fastify.post(
    '/api/payment/webhook',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const signature = request.headers['x-payu-signature'] as string;
        const payload = JSON.stringify(request.body);
        
        if (!signature || !payuService.validateWebhookSignature(payload, signature)) {
          fastify.log.warn('Invalid webhook signature');
          return reply.code(401).send({
            success: false,
            message: 'Invalid signature'
          });
        }
        
        // Process webhook data
        const webhookData = request.body as any;
        fastify.log.info('Webhook received:', webhookData);
        
        // TODO: Process webhook data according to your business logic
        // This might include updating payment status, sending notifications, etc.
        
        return reply.code(200).send({
          success: true,
          message: 'Webhook processed successfully'
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to process webhook',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/payment/transaction/:txnId
   * Get transaction details
   */
  fastify.get<{ Params: { txnId: string } }>(
    '/api/payment/transaction/:txnId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            txnId: { type: 'string' }
          },
          required: ['txnId']
        }
      }
    },
    async (request: FastifyRequest<{ Params: { txnId: string } }>, reply: FastifyReply) => {
      try {
        const { txnId } = request.params;
        
        const transactionDetails = await payuService.getTransactionDetails(txnId);
        
        if (!transactionDetails) {
          return reply.code(404).send({
            success: false,
            message: 'Transaction not found'
          });
        }
        
        return reply.code(200).send({
          success: true,
          data: transactionDetails,
          message: 'Transaction details retrieved successfully'
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to get transaction details',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/payment/refund
   * Initiate a refund
   */
  fastify.post<{
    Body: {
      transactionId: string;
      amount: number;
      refundAmount?: number;
    }
  }>(
    '/api/payment/refund',
    {
      schema: {
        body: {
          type: 'object',
          required: ['transactionId', 'amount'],
          properties: {
            transactionId: { type: 'string' },
            amount: { type: 'number', minimum: 1 },
            refundAmount: { type: 'number', minimum: 1 }
          }
        }
      }
    },
    async (request: FastifyRequest<{
      Body: {
        transactionId: string;
        amount: number;
        refundAmount?: number;
      }
    }>, reply: FastifyReply) => {
      try {
        const refundResult = await payuService.refundTransaction(request.body);
        
        if (refundResult.success) {
          fastify.log.info(`Refund initiated: ${refundResult.refundId} for transaction ${request.body.transactionId}`);
          
          return reply.code(200).send({
            success: true,
            data: refundResult,
            message: 'Refund initiated successfully'
          });
        } else {
          return reply.code(400).send({
            success: false,
            message: refundResult.message || 'Refund failed'
          });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: 'Failed to initiate refund',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}

export default paymentRoutes;