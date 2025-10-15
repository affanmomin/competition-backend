# Payment API Integration Guide for Frontend

This guide provides complete documentation for integrating Razorpay payments with the backend APIs. Copy this to your frontend repository for easy reference.

## Quick Start

1. **Get packages** → **Create order** → **Open Razorpay Checkout** → **Verify payment**
2. Replace `<API_HOST>` with your backend URL (e.g., `https://api.yourapp.com` or `http://localhost:3000`)
3. Add Authorization headers if your backend requires authentication

## API Endpoints Overview

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payments/packages` | GET | Get available subscription plans |
| `/api/payments/create-order` | POST | Create Razorpay order + DB records |
| `/api/payments/verify` | POST | Verify payment signature & complete transaction |


---

## API Documentation

### 1. Get Available Packages

**Purpose:** Fetch active subscription plans to display to users.

```bash
curl -X GET "<API_HOST>/api/payments/packages" \
  -H "Accept: application/json"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "package_id": "1",
      "package_type": "standard",
      "name": "Standard Plan",
      "description": "Perfect for small teams getting started",
      "price_inr": 1000,
      "price_paisa": 100000,
      "features": {
        "competitors": 5,
        "analytics": "basic",
        "support": "email"
      },
      "is_active": true
    },
    {
      "package_id": "2",
      "package_type": "professional", 
      "name": "Professional Plan",
      "description": "Advanced features for growing businesses",
      "price_inr": 3000,
      "price_paisa": 300000,
      "features": {
        "competitors": "unlimited",
        "analytics": "advanced",
        "support": "priority"
      },
      "is_active": true
    }
  ]
}
```

---

### 2. Create Payment Order

**Purpose:** Create a Razorpay order and database records. Returns order ID and public key for frontend checkout.

```bash
curl -X POST "<API_HOST>/api/payments/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "2",
    "customerEmail": "user@example.com",
    "customerPhone": "9999999999"
  }'
```

**Request Body:**
```json
{
  "packageId": "string",     // Required: from packages API
  "customerEmail": "string", // Optional
  "customerPhone": "string"  // Optional
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "orderId": "order_DBJOWzybf0sJbb",
    "amount": 300000, // Amount in paise
    "currency": "INR",
    "key": "rzp_test_RSxmuF1mnX0iYb", // Use this for Razorpay Checkout
    "package": {
      "package_id": "2",
      "name": "Professional Plan",
      "price_inr": 3000
    },
    "orderRecordId": "10"
  }
}
```

**Error Responses:**
- `400`: Missing required field: packageId
- `500`: Server error creating order

---

### 3. Verify Payment

**Purpose:** Verify Razorpay payment signature and complete the transaction.

```bash
curl -X POST "<API_HOST>/api/payments/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_DBJOWzybf0sJbb",
    "razorpay_payment_id": "pay_DBJxyZz1a2b3", 
    "razorpay_signature": "generated_signature_from_checkout",
    "packageId": "2"
  }'
```

**Request Body:**
```json
{
  "razorpay_order_id": "string",    // From Razorpay response
  "razorpay_payment_id": "string",  // From Razorpay response  
  "razorpay_signature": "string",   // From Razorpay response
  "packageId": "string"             // Package ID from create-order
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "order": { /* Updated payment order record */ },
    "paymentDetails": {
      "id": "pay_DBJxyZz1a2b3",
      "amount": 300000,
      "currency": "INR", 
      "method": "card",
      "status": "captured"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid payment signature (payment failed)
- `500`: Server error during verification



---

## Frontend Integration Code

### HTML Setup

Include Razorpay checkout script in your HTML:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### JavaScript Integration

```javascript
// API Helper Functions
async function apiCall(url, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Add authorization if needed:
      // 'Authorization': `Bearer ${userToken}`
    }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  return response.json();
}

// 1. Get Available Packages
async function getPackages() {
  return apiCall('<API_HOST>/api/payments/packages');
}

// 2. Create Order
async function createOrder(packageId, email, phone) {
  return apiCall('<API_HOST>/api/payments/create-order', 'POST', {
    packageId,
    customerEmail: email,
    customerPhone: phone
  });
}

// 3. Verify Payment
async function verifyPayment(paymentData) {
  return apiCall('<API_HOST>/api/payments/verify', 'POST', paymentData);
}

// Main Payment Handler (call this on button click)
async function handlePayment(packageId, user) {
  try {
    // Step 1: Create order
    const orderResponse = await createOrder(
      packageId, 
      user.email, 
      user.phone
    );
    
    if (!orderResponse.success) {
      throw new Error(orderResponse.error || 'Failed to create order');
    }
    
    const { orderId, amount, currency, key } = orderResponse.data;
    
    // Step 2: Configure Razorpay Checkout
    const options = {
      key, // Public key from backend
      amount, // Amount in paise
      currency,
      order_id: orderId,
      name: "Your App Name",
      description: "Subscription Payment",
      image: "/your-logo.png", // Optional
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.phone
      },
      theme: {
        color: "#3399cc" // Your brand color
      },
      handler: async function (response) {
        // Step 3: Verify payment on success
        try {
          const verifyResponse = await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            packageId: packageId
          });
          
          if (verifyResponse.success) {
            // Payment successful!
            alert('Payment successful! Your subscription is now active.');
            // Redirect or update UI
            window.location.href = '/dashboard';
          } else {
            throw new Error(verifyResponse.error || 'Payment verification failed');
          }
        } catch (error) {
          console.error('Verification error:', error);
          alert('Payment verification failed. Please contact support.');
        }
      },
      modal: {
        ondismiss: function() {
          console.log('Payment cancelled by user');
        }
      }
    };
    
    // Step 4: Open Razorpay Checkout
    const razorpay = new Razorpay(options);
    razorpay.open();
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('Failed to initiate payment: ' + error.message);
  }
}

// Example usage - wire to your pay button
document.getElementById('payButton').addEventListener('click', () => {
  const selectedPackage = '2'; // Get from your UI
  const currentUser = {
    name: 'John Doe', 
    email: 'john@example.com',
    phone: '9999999999'
  };
  
  handlePayment(selectedPackage, currentUser);
});
```

### React/Next.js Example

```jsx
import { useState } from 'react';

const PaymentComponent = ({ user, packageId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handlePayment = async () => {
    setIsProcessing(true);
    
    try {
      // Create order
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          customerEmail: user.email,
          customerPhone: user.phone
        })
      });
      
      const orderData = await orderResponse.json();
      if (!orderData.success) throw new Error(orderData.error);
      
      // Initialize Razorpay
      const { orderId, amount, currency, key } = orderData.data;
      
      const options = {
        key,
        amount,
        currency, 
        order_id: orderId,
        name: "Your App",
        handler: async (response) => {
          // Verify payment
          const verifyResponse = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...response,
              packageId
            })
          });
          
          const verifyData = await verifyResponse.json();
          if (verifyData.success) {
            alert('Payment successful!');
            // Handle success (redirect, update state, etc.)
          } else {
            alert('Payment verification failed');
          }
        }
      };
      
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (error) {
      alert('Payment failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <button 
      onClick={handlePayment}
      disabled={isProcessing}
    >
      {isProcessing ? 'Processing...' : 'Pay Now'}
    </button>
  );
};
```

---

## Testing

### Test Cards (Razorpay Test Mode)

| Card Number | Type | CVV | Expiry |
|-------------|------|-----|--------|
| 4111 1111 1111 1111 | Visa | 123 | Any future date |
| 5555 5555 5555 4444 | Mastercard | 123 | Any future date |
| 4000 0000 0000 0002 | Visa (Declined) | 123 | Any future date |

### Test UPI IDs
- `success@razorpay` - Success
- `failure@razorpay` - Failure

---

## Error Handling

### Common Errors & Solutions

1. **"Missing required field: packageId"** (400)
   - Ensure `packageId` is provided
   - Check field name matches exactly

2. **"Invalid payment signature"** (400) 
   - Payment was tampered with or failed
   - Show error message and allow retry
   - Log for investigation

3. **Razorpay Checkout not opening**
   - Ensure script is loaded: `<script src="https://checkout.razorpay.com/v1/checkout.js"></script>`
   - Must be triggered by user gesture (click event)
   - Check browser popup blockers

4. **Network/Server errors** (500)
   - Show "Please try again" message  
   - Implement retry logic with exponential backoff
   - Log errors for debugging

### Error Handling Pattern

```javascript
try {
  const response = await apiCall(url, method, body);
  
  if (!response.success) {
    // Handle API-level errors
    throw new Error(response.error || 'API call failed');
  }
  
  return response.data;
  
} catch (error) {
  // Handle network/parsing errors
  console.error('API Error:', error);
  
  // Show user-friendly message
  if (error.message.includes('network') || error.message.includes('fetch')) {
    alert('Network error. Please check your connection and try again.');
  } else {
    alert(error.message || 'Something went wrong. Please try again.');
  }
  
  throw error; // Re-throw if caller needs to handle
}
```

---

## Security Notes

⚠️ **Important Security Guidelines:**

1. **Never expose Razorpay secret key** - Only use public key (`rzp_test_...`) on frontend
2. **Always verify payments server-side** - Never trust client-side verification
3. **Use HTTPS in production** - Required for live payments
4. **Implement rate limiting** - Prevent abuse of create-order endpoint
5. **Validate user authentication** - Add auth headers if required
6. **Log payment events** - For debugging and fraud detection

---

## Production Checklist

Before going live:

- [ ] Replace test keys with live Razorpay keys (backend only)
- [ ] Complete Razorpay KYC and account activation
- [ ] Enable HTTPS on frontend and backend
- [ ] Add proper error logging and monitoring
- [ ] Test with real bank accounts (small amounts)
- [ ] Implement webhooks for payment status updates
- [ ] Add proper user authentication to payment endpoints
- [ ] Set up proper database backups
- [ ] Configure rate limiting and DDoS protection

---

## Additional Resources

- [Razorpay Checkout Documentation](https://razorpay.com/docs/payments/payment-gateway/web-integration/)
- [Razorpay Test Cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/)
- [Backend API Source Code](./src/routes/payments.ts)

---

## Support

For backend API issues, contact the backend team.
For Razorpay integration issues, refer to [Razorpay Support](https://razorpay.com/support/).

---

**Last Updated:** October 14, 2025