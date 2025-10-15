-- Razorpay Integration Setup
-- Your existing tables are already set up correctly:
-- - packages (for payment plans)  
-- - user_packages (for user subscriptions)
-- - payment_transactions (for payment records)

-- Insert default packages if they don't exist
INSERT INTO public.packages (package_type, name, description, price_inr, price_paisa, features, is_active)
VALUES 
  (
    'standard', 
    'Standard Plan', 
    'Perfect for small teams getting started with competitor analysis',
    1000, 
    100000, 
    '{"competitors": 5, "analytics": "basic", "support": "email", "retention": "30 days", "reports": false, "api_access": false}',
    true
  ),
  (
    'professional', 
    'Professional Plan', 
    'Advanced features for growing businesses',
    3000, 
    300000, 
    '{"competitors": "unlimited", "analytics": "advanced", "support": "priority", "retention": "1 year", "reports": true, "api_access": true}',
    true
  )
ON CONFLICT (package_type) DO NOTHING;

-- Add useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON public.user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_status ON public.user_packages(package_status);
CREATE INDEX IF NOT EXISTS idx_user_packages_expires ON public.user_packages(expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(razorpay_order_id);

-- Add comments for documentation
COMMENT ON TABLE public.packages IS 'Available subscription packages/plans';
COMMENT ON TABLE public.user_packages IS 'User subscriptions to packages';
COMMENT ON TABLE public.payment_transactions IS 'Razorpay payment transaction records';

COMMENT ON COLUMN public.packages.price_paisa IS 'Price in paise (for Razorpay API)';
COMMENT ON COLUMN public.packages.price_inr IS 'Price in rupees (for display)';
COMMENT ON COLUMN public.user_packages.payment_amount IS 'Amount paid in paise';
COMMENT ON COLUMN public.payment_transactions.amount IS 'Transaction amount in paise';