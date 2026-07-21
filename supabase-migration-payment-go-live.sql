-- ============================================
-- Payment go-live hardening
-- Apply after supabase-migration-payment.sql and invoice migrations.
-- ============================================

-- Canonical payment fields, idempotency, public invoice access, and recovery state.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS customer_whatsapp_normalized TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS catalog_subtotal INTEGER,
  ADD COLUMN IF NOT EXISTS payable_amount INTEGER,
  ADD COLUMN IF NOT EXISTS price_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS related_invoice_id UUID,
  ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS upload_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS poster_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (poster_status IN ('pending', 'uploaded', 'deferred')),
  ADD COLUMN IF NOT EXISTS poster_deferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

UPDATE payment_orders
SET
  customer_whatsapp_normalized = CASE
    WHEN customer_whatsapp ~ '^0' THEN '62' || substring(regexp_replace(customer_whatsapp, '\\D', '', 'g') FROM 2)
    ELSE regexp_replace(customer_whatsapp, '\\D', '', 'g')
  END,
  catalog_subtotal = COALESCE(catalog_subtotal, amount),
  payable_amount = COALESCE(payable_amount, total_amount, amount),
  public_token = COALESCE(public_token, gen_random_uuid()),
  upload_token = COALESCE(upload_token, gen_random_uuid())
WHERE customer_whatsapp_normalized IS NULL
   OR catalog_subtotal IS NULL
   OR payable_amount IS NULL
   OR public_token IS NULL
   OR upload_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_idempotency
  ON payment_orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_public_token
  ON payment_orders (public_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_upload_token
  ON payment_orders (upload_token);

-- Link all operational records to the exact payment order.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_order_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_order_id TEXT;
ALTER TABLE posting_queue ADD COLUMN IF NOT EXISTS poster_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE posting_queue ADD COLUMN IF NOT EXISTS poster_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (poster_status IN ('pending', 'uploaded', 'deferred'));
ALTER TABLE posting_queue ADD COLUMN IF NOT EXISTS poster_deferred_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_order_id
  ON invoices (payment_order_id)
  WHERE payment_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_payment_order_id
  ON transactions (payment_order_id)
  WHERE payment_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_posting_queue_order_id_unique
  ON posting_queue (order_id)
  WHERE order_id IS NOT NULL;

-- Provider events are retained for audit/reconciliation and safely deduplicated.
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES payment_orders(order_id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  provider_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id, created_at DESC);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on payment_events"
  ON payment_events FOR ALL
  USING (auth.role() = 'authenticated');

-- Public clients no longer require broad table SELECT/UPDATE policies. Remove the
-- permissive policies from supabase-migration-payment.sql after the application is
-- deployed and the service-role environment variable is configured:
-- DROP POLICY IF EXISTS "Allow public select on payment_orders" ON payment_orders;
-- DROP POLICY IF EXISTS "Allow public update on payment_orders" ON payment_orders;
-- DROP POLICY IF EXISTS "Allow public insert on payment_orders" ON payment_orders;
