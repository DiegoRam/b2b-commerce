-- Add medusa_order_id column to orders table for MedusaJS integration
-- This allows storing the corresponding MedusaJS order ID for order synchronization

-- Add medusa_order_id column to orders table
ALTER TABLE orders ADD COLUMN medusa_order_id TEXT;

-- Add index for performance
CREATE INDEX idx_orders_medusa_order_id ON orders(medusa_order_id);

-- Add comment for documentation
COMMENT ON COLUMN orders.medusa_order_id IS 'Corresponding MedusaJS order ID for synchronization';