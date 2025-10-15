# Razorpay Payment Integration API Documentation

## Overview
This API integrates Razorpay payment gateway with your competition-backend application. It supports two subscription plans: Standard (₹1,000) and Professional (₹3,000).

## Test Credentials
- **Razorpay Key ID**: `rzp_test_RSxmuF1mnX0iYb`
- **Razorpay Secret**: `fzFj5ITIcU59JMS7V1DCr7A3`
- **Mode**: Test Mode

## Database Setup

First, run the SQL script to create the required tables:

```sql
-- Run the contents of database-schema-payments.sql in your PostgreSQL database
```

## API Endpoints

### 1. Get Payment Plans
```http
GET /api/payments/plans
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "standard",
      "name": "Standard Plan",
      "price": 100000,
      "priceInRupees": 1000,
      "currency": "INR",
      "features": [
        "Up to 5 competitors",
        "Basic analytics",
        "Email support",
        "30-day data retention"
      ]
    },
    {
      "id": "professional",
      "name": "Professional Plan", 
      "price": 300000,
      "priceInRupees": 3000,
      "currency": "INR",
      "features": [
        "Unlimited competitors",
        "Advanced analytics",
        "Priority support",
        "1-year data retention",
        "Custom reports",
        "API access"
      ]
    }
  ]
}
```

### 2. Create Payment Order
```http
POST /api/payments/create-order
```

**Request Body:**
```json
{
  "planId": "standard", // or "professional"
  "userId": "user123",
  "customerEmail": "customer@example.com", // optional
  "customerPhone": "+919876543210" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_razorpay_id_here",
    "amount": 100000,
    "currency": "INR",
    "key": "rzp_test_RSxmuF1mnX0iYb",
    "plan": {
      "id": "standard",
      "name": "Standard Plan",
      "price": 100000,
      "currency": "INR",
      "features": [...]
    },
    "dbOrder": {
      "id": "uuid",
      "razorpay_order_id": "order_id",
      "user_id": "user123",
      "status": "created",
      ...
    }
  }
}
```

### 3. Verify Payment
```http
POST /api/payments/verify
```

**Request Body:**
```json
{
  "razorpay_order_id": "order_id_from_razorpay",
  "razorpay_payment_id": "payment_id_from_razorpay",
  "razorpay_signature": "signature_from_razorpay",
  "userId": "user123",
  "planId": "standard"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "order": {
      "id": "uuid",
      "status": "completed",
      "razorpay_payment_id": "payment_id",
      ...
    },
    "subscription": {
      "id": "uuid",
      "user_id": "user123",
      "plan_id": "standard",
      "status": "active",
      "start_date": "2025-10-14T10:00:00.000Z",
      "end_date": "2025-11-14T10:00:00.000Z",
      ...
    },
    "paymentDetails": {
      "id": "payment_id",
      "amount": 100000,
      "currency": "INR",
      "method": "card",
      "status": "captured"
    }
  }
}
```

### 4. Get Payment History
```http
GET /api/payments/history?userId=user123&status=completed&limit=10&offset=0
```

**Query Parameters:**
- `userId` (required): User ID
- `status` (optional): Filter by payment status (`created`, `completed`, `failed`)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

### 5. Get Current Subscription
```http
GET /api/payments/subscription?userId=user123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "user123",
    "plan_id": "standard",
    "plan_name": "Standard Plan",
    "amount_paid": 100000,
    "currency": "INR",
    "status": "active",
    "start_date": "2025-10-14T10:00:00.000Z",
    "end_date": "2025-11-14T10:00:00.000Z",
    "created_at": "2025-10-14T10:00:00.000Z"
  }
}
```

## Frontend Integration

### Step 1: Include Razorpay SDK
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Step 2: Create Order
```javascript
async function createOrder(planId) {
  const response = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: planId,
      userId: 'user123',
      customerEmail: 'customer@example.com'
    })
  });
  
  const data = await response.json();
  if (data.success) {
    openRazorpayModal(data.data);
  }
}
```

### Step 3: Open Razorpay Modal
```javascript
function openRazorpayModal(orderData) {
  const options = {
    key: orderData.key,
    amount: orderData.amount,
    currency: orderData.currency,
    name: 'Your Company',
    description: orderData.plan.name,
    order_id: orderData.orderId,
    handler: function (response) {
      verifyPayment(response);
    },
    prefill: {
      name: 'Customer Name',
      email: 'customer@example.com',
      contact: '+919876543210'
    },
    theme: { color: '#3399cc' }
  };
  
  const rzp = new Razorpay(options);
  rzp.open();
}
```

### Step 4: Verify Payment
```javascript
async function verifyPayment(razorpayResponse) {
  const response = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_signature: razorpayResponse.razorpay_signature,
      userId: 'user123',
      planId: 'standard'
    })
  });
  
  const data = await response.json();
  if (data.success) {
    // Payment successful - redirect to dashboard
    window.location.href = '/dashboard';
  }
}
```

## Testing

### Test Card Numbers
Use these test card numbers in test mode:

- **Success**: 4111 1111 1111 1111
- **Failure**: 4000 0000 0000 0002
- **CVV**: Any 3 digits
- **Expiry**: Any future date

### Test UPI IDs
- **Success**: success@razorpay
- **Failure**: failure@razorpay

### Test Wallets
All wallets work in test mode with dummy credentials.

## Error Handling

Common error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Error Codes:**
- `400`: Bad Request (missing/invalid parameters)
- `404`: Resource not found
- `500`: Internal server error

## Security Notes

1. **Never expose the Razorpay secret** in frontend code
2. **Always verify payments** on the server side
3. **Use HTTPS** in production
4. **Validate user permissions** before processing payments
5. **Log all payment transactions** for audit purposes

## Production Checklist

Before going live:

1. ✅ Replace test credentials with live credentials
2. ✅ Update webhook URLs in Razorpay dashboard
3. ✅ Implement proper error logging
4. ✅ Add rate limiting to payment endpoints
5. ✅ Test with real payment methods
6. ✅ Implement subscription renewal logic
7. ✅ Add email notifications for successful payments
8. ✅ Implement refund handling if needed