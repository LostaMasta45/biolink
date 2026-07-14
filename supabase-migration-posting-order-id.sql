-- ============================================
-- Add order_id to posting_queue for payment linking
-- Run this in Supabase SQL Editor
-- ============================================

-- Add order_id column to posting_queue for linking payment orders
ALTER TABLE posting_queue ADD COLUMN IF NOT EXISTS order_id TEXT;

-- Add caption column for customer-provided caption
ALTER TABLE posting_queue ADD COLUMN IF NOT EXISTS caption TEXT;

-- Index for quick lookup by order_id
CREATE INDEX IF NOT EXISTS idx_posting_queue_order_id ON posting_queue(order_id);
