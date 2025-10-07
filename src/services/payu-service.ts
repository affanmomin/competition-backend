import crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { payuConfig } from '../config/payu';
import {
  PaymentRequest,
  PaymentResponse,
  PaymentVerificationRequest,
  TransactionDetails,
  PaymentStatus
} from '../types/payment';

export class PayUService {
  private generateHash(data: string): string {
    return crypto.createHash('sha512').update(data).digest('hex');
  }

  private generateTransactionId(): string {
    return `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  /**
   * Generate payment hash for PayU
   */
  private generatePaymentHash(params: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  }): string {
    const { key, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5 } = params;
    
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1 || ''}|${udf2 || ''}|${udf3 || ''}|${udf4 || ''}|${udf5 || ''}||||||${payuConfig.salt}`;
    
    return this.generateHash(hashString);
  }

  /**
   * Verify payment response hash
   */
  private verifyResponseHash(params: PaymentVerificationRequest): boolean {
    const { status, txnid, amount, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, hash } = params;
    
    // PayU response hash format: salt|status|||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    const hashString = `${payuConfig.salt}|${status}|||||||${udf5 || ''}|${udf4 || ''}|${udf3 || ''}|${udf2 || ''}|${udf1 || ''}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${payuConfig.key}`;
    
    const calculatedHash = this.generateHash(hashString);
    
    return calculatedHash === hash;
  }

  /**
   * Initialize payment and get payment form data
   */
  async initiatePayment(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    try {
      const txnid = paymentRequest.orderId || this.generateTransactionId();
      
      const paymentData = {
        key: payuConfig.key,
        txnid,
        amount: paymentRequest.amount.toString(),
        productinfo: paymentRequest.productInfo,
        firstname: paymentRequest.firstName,
        email: paymentRequest.email,
        phone: paymentRequest.phone,
        surl: paymentRequest.successUrl || `${process.env.BASE_URL}/api/payment/success`,
        furl: paymentRequest.failureUrl || `${process.env.BASE_URL}/api/payment/failure`,
        udf1: paymentRequest.userDefined1,
        udf2: paymentRequest.userDefined2,
        udf3: paymentRequest.userDefined3,
        udf4: paymentRequest.userDefined4,
        udf5: paymentRequest.userDefined5
      };

      const hash = this.generatePaymentHash(paymentData);

      return {
        ...paymentData,
        hash,
        service_provider: 'payu_paisa'
      };
    } catch (error) {
      console.error('Error initiating payment:', error);
      throw new Error('Failed to initiate payment');
    }
  }

  /**
   * Verify payment response from PayU
   */
  async verifyPayment(paymentResponse: PaymentVerificationRequest): Promise<{
    isValid: boolean;
    status: PaymentStatus;
    transactionId: string;
    amount: string;
  }> {
    try {
      // First verify the hash
      const isHashValid = this.verifyResponseHash(paymentResponse);
      
      if (!isHashValid) {
        console.error('Invalid hash in payment response');
        return {
          isValid: false,
          status: PaymentStatus.FAILURE,
          transactionId: paymentResponse.txnid,
          amount: paymentResponse.amount
        };
      }

      // Map PayU status to our enum
      let status: PaymentStatus;
      switch (paymentResponse.status.toLowerCase()) {
        case 'success':
          status = PaymentStatus.SUCCESS;
          break;
        case 'pending':
          status = PaymentStatus.PENDING;
          break;
        case 'failure':
        case 'failed':
          status = PaymentStatus.FAILURE;
          break;
        default:
          status = PaymentStatus.CANCELLED;
      }

      return {
        isValid: true,
        status,
        transactionId: paymentResponse.txnid,
        amount: paymentResponse.amount
      };
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        isValid: false,
        status: PaymentStatus.FAILURE,
        transactionId: paymentResponse.txnid,
        amount: paymentResponse.amount
      };
    }
  }

  /**
   * Get transaction details from PayU
   */
  async getTransactionDetails(transactionId: string): Promise<TransactionDetails | null> {
    try {
      const command = 'verify_payment';
      const hashString = `${payuConfig.key}|${command}|${transactionId}|${payuConfig.salt}`;
      const hash = this.generateHash(hashString);

      const response = await axios.post(payuConfig.urls.verify, {
        key: payuConfig.key,
        command,
        hash,
        var1: transactionId
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.status === 1) {
        return response.data.transaction_details;
      }

      return null;
    } catch (error) {
      console.error('Error getting transaction details:', error);
      return null;
    }
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(params: {
    transactionId: string;
    amount: number;
    refundAmount?: number;
  }): Promise<{
    success: boolean;
    refundId?: string;
    message?: string;
  }> {
    try {
      const { transactionId, amount, refundAmount = amount } = params;
      const command = 'cancel_refund_transaction';
      const refundId = `REFUND${Date.now()}`;
      
      const hashString = `${payuConfig.key}|${command}|${transactionId}|${refundAmount}|${payuConfig.salt}`;
      const hash = this.generateHash(hashString);

      const response = await axios.post(payuConfig.urls.refund, {
        key: payuConfig.key,
        command,
        hash,
        var1: transactionId,
        var2: refundAmount,
        var3: refundId
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.status === 1) {
        return {
          success: true,
          refundId,
          message: 'Refund initiated successfully'
        };
      }

      return {
        success: false,
        message: response.data?.msg || 'Refund failed'
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      return {
        success: false,
        message: 'Failed to process refund'
      };
    }
  }

  /**
   * Get payment form URL for redirection
   */
  getPaymentUrl(): string {
    return payuConfig.urls.payment;
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha512', payuConfig.salt)
        .update(payload)
        .digest('hex');
      
      // Ensure both signatures have the same length before comparison
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }
}

export const payuService = new PayUService();