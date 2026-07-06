-- ============================================
-- Payment Orders Table for QRIS Integration
-- ============================================

CREATE TABLE IF NOT EXISTS payment_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,

    -- Customer Info
    customer_name TEXT NOT NULL,
    customer_whatsapp TEXT NOT NULL,
    customer_company TEXT NOT NULL,

    -- Package & Add-ons
    package_id INTEGER NOT NULL,
    package_name TEXT NOT NULL,
    addons INTEGER[] DEFAULT '{}',
    addon_names TEXT[] DEFAULT '{}',

    -- Amounts
    amount INTEGER NOT NULL,
    total_amount INTEGER,

    -- QRIS Data
    qris_url TEXT,
    qris_image TEXT,
    direct_url TEXT,
    signature TEXT,

    -- Status
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
    expired_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,

    -- Integration sync flags
    synced_to_finance BOOLEAN DEFAULT FALSE,
    synced_to_posting BOOLEAN DEFAULT FALSE,
    related_transaction_id TEXT,
    related_posting_id TEXT,

    -- Notes
    keterangan TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at DESC);

-- RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on payment_orders"
    ON payment_orders FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public insert on payment_orders"
    ON payment_orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public select on payment_orders"
    ON payment_orders FOR SELECT
    USING (true);

CREATE POLICY "Allow public update on payment_orders"
    ON payment_orders FOR UPDATE
    USING (true);
