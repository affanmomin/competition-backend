# Razorpay Payment Integration - Updated for Existing Schema

## Overview
This integration works with your existing database schema using the `packages`, `user_packages`, and `payment_transactions` tables.

## Database Setup
Run this SQL to initialize default packages and add indexes:

```sql
-- Run the contents of database-schema-payments.sql
```

## API Endpoints

### 1. Get Available Packages
```http
GET /api/payments/packages
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "package_id": "uuid-here",
      "package_type": "standard",
      "name": "Standard Plan",
      "description": "Perfect for small teams getting started with competitor analysis",
      "price_inr": 1000,
      "price_paisa": 100000,
      "features": {
        "competitors": 5,
        "analytics": "basic",
        "support": "email",
        "retention": "30 days"
      },
      "is_active": true
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
  "packageId": "package-uuid-here",
  "userId": "user123",
  "customerEmail": "customer@example.com",
  "customerPhone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "order_razorpay_id",
    "amount": 100000,
    "currency": "INR",
    "key": "rzp_test_RSxmuF1mnX0iYb",
    "package": {
      "package_id": "uuid",
      "name": "Standard Plan",
      "price_inr": 1000,
      "price_paisa": 100000
    },
    "userPackageId": "user-package-uuid",
    "transactionId": "transaction-uuid"
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
  "packageId": "package-uuid"
}
```

### 4. Get Payment History
```http
GET /api/payments/history?userId=user123
```

### 5. Get Current Subscription
```http
GET /api/payments/subscription?userId=user123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_package_id": "uuid",
    "user_id": "user123",
    "package_id": "uuid",
    "payment_status": "completed",
    "package_status": "active",
    "activated_at": "2025-10-14T10:00:00Z",
    "expires_at": "2025-11-14T10:00:00Z",
    "package_name": "Standard Plan",
    "package_type": "standard",
    "features": {...}
  }
}
```

### 6. Cancel Subscription
```http
POST /api/payments/cancel-subscription
```

**Request Body:**
```json
{
  "userId": "user123",
  "userPackageId": "user-package-uuid"
}
```

## Frontend Integration (Updated)

### Step 1: Get packages and create order
```javascript
// Get available packages first
async function loadPackages() {
  const response = await fetch('/api/payments/packages');
  const data = await response.json();
  return data.data; // Array of packages
}

// Create order with packageId (not packageType)
async function createOrder(packageId) {
  const response = await fetch('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageId: packageId, // Use actual UUID from packages
      userId: 'user123',
      customerEmail: 'customer@example.com'
    })
  });
  
  const data = await response.json();
  if (data.success) {
    openRazorpayModal(data.data, packageId);
  }
}
```

## Key Changes from Original Integration

1. **Uses existing tables**: `packages`, `user_packages`, `payment_transactions`
2. **Package IDs are UUIDs**: Not hardcoded strings
3. **Flexible package structure**: Features stored as JSON
4. **Better subscription tracking**: With activation and expiry dates
5. **Transaction logging**: Complete Razorpay response stored

## Database Schema Mapping

| Original | Your Schema | Purpose |
|----------|-------------|---------|
| `payment_orders` | `user_packages` + `payment_transactions` | Order tracking |
| `subscriptions` | `user_packages` | Subscription status |
| `PAYMENT_PLANS` (hardcoded) | `packages` table | Package definitions |

## Testing Steps

1. **Run database setup**:
   ```sql
   -- Execute database-schema-payments.sql
   ```

2. **Start server**:
   ```bash
   pnpm dev
   ```

3. **Test API endpoints**:
   ```bash
   # Get packages
   curl http://localhost:3000/api/payments/packages
   
   # Test with payment-integration-example.html
   ```

4. **Use test credentials**:
   - Card: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date

Your integration is now fully compatible with your existing database schema while maintaining all Razorpay functionality!