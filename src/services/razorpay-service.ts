const Razorpay = require('razorpay');
import crypto from 'crypto';

// Razorpay Configuration
const razorpay = new Razorpay({
  key_id: 'rzp_test_RSxmuF1mnX0iYb',
  key_secret: 'fzFj5ITIcU59JMS7V1DCr7A3',
});

// Test the Razorpay instance
console.log('Razorpay instance created:', !!razorpay);

export interface PaymentPlan {
  package_id: string;
  package_type: string;
  name: string;
  description: string;
  price_inr: number;
  price_paisa: number;
  features: any;
  is_active: boolean;
}

// We'll fetch plans from database instead of hardcoding them
export const DEFAULT_PLANS = [
  {
    package_type: 'standard',
    name: 'Standard Plan',
    description: 'Perfect for small teams getting started with competitor analysis',
    price_inr: 1000,
    price_paisa: 100000,
    features: {
      competitors: 5,
      analytics: 'basic',
      support: 'email',
      retention: '30 days',
      reports: false,
      api_access: false
    }
  },
  {
    package_type: 'professional',
    name: 'Professional Plan',
    description: 'Advanced features for growing businesses',
    price_inr: 3000,
    price_paisa: 300000,
    features: {
      competitors: 'unlimited',
      analytics: 'advanced',
      support: 'priority',
      retention: '1 year',
      reports: true,
      api_access: true
    }
  }
];

export interface CreateOrderParams {
  packageId: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Record<string, any>;
  created_at: number;
}

/**
 * Create a Razorpay order
 */
export async function createRazorpayOrder(params: CreateOrderParams, plan: PaymentPlan): Promise<RazorpayOrder> {
  const { packageId, customerEmail, customerPhone } = params;
  
  // Keep receipt under 40 characters as per Razorpay requirement
  const receipt = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const orderOptions = {
    amount: plan.price_paisa, // Amount in paise
    currency: 'INR',
    receipt: receipt,
    notes: {
      packageId: packageId,
      planName: plan.name,
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
    },
  };

  try {
    console.log('Creating Razorpay order with options:', orderOptions);
    console.log('Razorpay instance available:', !!razorpay);
    console.log('Razorpay orders method available:', !!razorpay.orders);
    
    if (!razorpay || !razorpay.orders) {
      throw new Error('Razorpay instance not properly initialized');
    }
    
    const order = await razorpay.orders.create(orderOptions);
    console.log('Razorpay order created successfully:', order);
    return order as RazorpayOrder;
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw new Error(`Failed to create payment order: ${error.message || JSON.stringify(error)}`);
  }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyRazorpayPayment(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
  
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', 'fzFj5ITIcU59JMS7V1DCr7A3')
    .update(body.toString())
    .digest('hex');

  return expectedSignature === razorpay_signature;
}

/**
 * Get payment details from Razorpay
 */
export async function getPaymentDetails(paymentId: string) {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error: any) {
    console.error('Error fetching payment details:', error);
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
}

/**
 * Get order details from Razorpay
 */
export async function getOrderDetails(orderId: string) {
  try {
    const order = await razorpay.orders.fetch(orderId);
    return order;
  } catch (error: any) {
    console.error('Error fetching order details:', error);
    throw new Error(`Failed to fetch order details: ${error.message}`);
  }
}

export default razorpay;