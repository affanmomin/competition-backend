-- Update user_packages table to allow NULL user_id for guest payments
ALTER TABLE public.user_packages 
ALTER COLUMN user_id DROP NOT NULL;

-- Add customer details columns to user_packages for guest orders
ALTER TABLE public.user_packages 
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_packages_customer_email 
ON public.user_packages(customer_email);

-- Update the foreign key constraint to allow NULL values
ALTER TABLE public.user_packages 
DROP CONSTRAINT IF EXISTS user_packages_user_id_fkey;

ALTER TABLE public.user_packages 
ADD CONSTRAINT user_packages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public."user"(id) 
ON DELETE SET NULL;