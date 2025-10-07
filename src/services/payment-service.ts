import { Client } from 'pg';
import client from '../db';
import { PaymentStatus } from '../types/payment';

export interface PaymentRecord {
  id: string;
  transactionId: string;
  payuPaymentId?: string;
  userId: string;
  amount: number;
  currency: string;
  productInfo: string;
  status: PaymentStatus;
  paymentMethod?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  successUrl?: string;
  failureUrl?: string;
  userDefined1?: string;
  userDefined2?: string;
  userDefined3?: string;
  userDefined4?: string;
  userDefined5?: string;
  payuResponse?: any;
  createdAt: Date;
  updatedAt: Date;
  paymentDate?: Date;
}

export interface RefundRecord {
  id: string;
  paymentId: string;
  refundId: string;
  payuRefundId?: string;
  amount: number;
  status: string;
  reason?: string;
  payuResponse?: any;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
}

export class PaymentService {
  private db: Client;

  constructor() {
    this.db = client;
  }

  /**
   * Create a new payment record
   */
  async createPayment(paymentData: {
    transactionId: string;
    userId: string;
    amount: number;
    currency?: string;
    productInfo: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    successUrl?: string;
    failureUrl?: string;
    userDefined1?: string;
    userDefined2?: string;
    userDefined3?: string;
    userDefined4?: string;
    userDefined5?: string;
  }): Promise<PaymentRecord> {
    const query = `
      INSERT INTO payments (
        transaction_id,
        user_id,
        amount,
        currency,
        product_info,
        customer_name,
        customer_email,
        customer_phone,
        success_url,
        failure_url,
        user_defined_1,
        user_defined_2,
        user_defined_3,
        user_defined_4,
        user_defined_5,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;

    const values = [
      paymentData.transactionId,
      paymentData.userId,
      paymentData.amount,
      paymentData.currency || 'INR',
      paymentData.productInfo,
      paymentData.customerName,
      paymentData.customerEmail,
      paymentData.customerPhone,
      paymentData.successUrl,
      paymentData.failureUrl,
      paymentData.userDefined1,
      paymentData.userDefined2,
      paymentData.userDefined3,
      paymentData.userDefined4,
      paymentData.userDefined5,
      PaymentStatus.PENDING
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToPaymentRecord(result.rows[0]);
  }

  /**
   * Update payment status and PayU response
   */
  async updatePaymentStatus(
    transactionId: string,
    status: PaymentStatus,
    payuPaymentId?: string,
    payuResponse?: any,
    paymentMethod?: string
  ): Promise<PaymentRecord | null> {
    const query = `
      UPDATE payments 
      SET status = $1,
          payu_payment_id = COALESCE($2, payu_payment_id),
          payu_response = COALESCE($3, payu_response),
          payment_method = COALESCE($4, payment_method),
          payment_date = CASE WHEN $1 = 'success' THEN NOW() ELSE payment_date END,
          updated_at = NOW()
      WHERE transaction_id = $5
      RETURNING *
    `;

    const values = [status, payuPaymentId, payuResponse ? JSON.stringify(payuResponse) : null, paymentMethod, transactionId];
    const result = await this.db.query(query, values);
    
    return result.rows.length > 0 ? this.mapRowToPaymentRecord(result.rows[0]) : null;
  }

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId: string): Promise<PaymentRecord | null> {
    const query = 'SELECT * FROM payments WHERE transaction_id = $1';
    const result = await this.db.query(query, [transactionId]);
    
    return result.rows.length > 0 ? this.mapRowToPaymentRecord(result.rows[0]) : null;
  }

  /**
   * Get payment by PayU payment ID
   */
  async getPaymentByPayUId(payuPaymentId: string): Promise<PaymentRecord | null> {
    const query = 'SELECT * FROM payments WHERE payu_payment_id = $1';
    const result = await this.db.query(query, [payuPaymentId]);
    
    return result.rows.length > 0 ? this.mapRowToPaymentRecord(result.rows[0]) : null;
  }

  /**
   * Get payments for a user with pagination
   */
  async getUserPayments(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: PaymentStatus
  ): Promise<{ payments: PaymentRecord[]; total: number }> {
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = $1';
    const values: any[] = [userId];
    
    if (status) {
      whereClause += ' AND status = $2';
      values.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM payments ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get payments
    const paymentsQuery = `
      SELECT * FROM payments 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    values.push(limit, offset);
    
    const paymentsResult = await this.db.query(paymentsQuery, values);
    const payments = paymentsResult.rows.map(row => this.mapRowToPaymentRecord(row));

    return { payments, total };
  }

  /**
   * Create a refund record
   */
  async createRefund(refundData: {
    paymentId: string;
    refundId: string;
    amount: number;
    reason?: string;
  }): Promise<RefundRecord> {
    const query = `
      INSERT INTO payment_refunds (
        payment_id,
        refund_id,
        amount,
        reason,
        status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      refundData.paymentId,
      refundData.refundId,
      refundData.amount,
      refundData.reason,
      'pending'
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToRefundRecord(result.rows[0]);
  }

  /**
   * Update refund status
   */
  async updateRefundStatus(
    refundId: string,
    status: string,
    payuRefundId?: string,
    payuResponse?: any
  ): Promise<RefundRecord | null> {
    const query = `
      UPDATE payment_refunds 
      SET status = $1,
          payu_refund_id = COALESCE($2, payu_refund_id),
          payu_response = COALESCE($3, payu_response),
          processed_at = CASE WHEN $1 IN ('success', 'failed') THEN NOW() ELSE processed_at END,
          updated_at = NOW()
      WHERE refund_id = $4
      RETURNING *
    `;

    const values = [status, payuRefundId, payuResponse ? JSON.stringify(payuResponse) : null, refundId];
    const result = await this.db.query(query, values);
    
    return result.rows.length > 0 ? this.mapRowToRefundRecord(result.rows[0]) : null;
  }

  /**
   * Log webhook for audit purposes
   */
  async logWebhook(webhookData: {
    webhookType: string;
    payload: any;
    signature?: string;
  }): Promise<void> {
    const query = `
      INSERT INTO payment_webhooks (
        webhook_type,
        payload,
        signature
      ) VALUES ($1, $2, $3)
    `;

    const values = [
      webhookData.webhookType,
      JSON.stringify(webhookData.payload),
      webhookData.signature
    ];

    await this.db.query(query, values);
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(webhookId: string, processingError?: string): Promise<void> {
    const query = `
      UPDATE payment_webhooks 
      SET processed = true,
          processed_at = NOW(),
          processing_error = $2
      WHERE id = $1
    `;

    await this.db.query(query, [webhookId, processingError]);
  }

  /**
   * Get payment statistics for a user
   */
  async getPaymentStats(userId: string): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
    totalAmount: number;
    successfulAmount: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'success') as successful_payments,
        COUNT(*) FILTER (WHERE status = 'failure') as failed_payments,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_payments,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) as successful_amount
      FROM payments 
      WHERE user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    const row = result.rows[0];

    return {
      totalPayments: parseInt(row.total_payments),
      successfulPayments: parseInt(row.successful_payments),
      failedPayments: parseInt(row.failed_payments),
      pendingPayments: parseInt(row.pending_payments),
      totalAmount: parseFloat(row.total_amount),
      successfulAmount: parseFloat(row.successful_amount)
    };
  }

  private mapRowToPaymentRecord(row: any): PaymentRecord {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      payuPaymentId: row.payu_payment_id,
      userId: row.user_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      productInfo: row.product_info,
      status: row.status,
      paymentMethod: row.payment_method,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      successUrl: row.success_url,
      failureUrl: row.failure_url,
      userDefined1: row.user_defined_1,
      userDefined2: row.user_defined_2,
      userDefined3: row.user_defined_3,
      userDefined4: row.user_defined_4,
      userDefined5: row.user_defined_5,
      payuResponse: row.payu_response,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      paymentDate: row.payment_date
    };
  }

  private mapRowToRefundRecord(row: any): RefundRecord {
    return {
      id: row.id,
      paymentId: row.payment_id,
      refundId: row.refund_id,
      payuRefundId: row.payu_refund_id,
      amount: parseFloat(row.amount),
      status: row.status,
      reason: row.reason,
      payuResponse: row.payu_response,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at
    };
  }
}

export const paymentService = new PaymentService();