-- WhatsApp Notification Center + Admin Bot Commands
-- Jalankan setelah supabase-migration-whatsapp-manager.sql dan template-v3.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE templates ADD COLUMN IF NOT EXISTS usage_context TEXT;

CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'admin', 'bot', 'custom')),
    custom_recipient TEXT,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'bot')),
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    delay_seconds INTEGER NOT NULL DEFAULT 0 CHECK (delay_seconds BETWEEN 0 AND 86400),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    dedupe_window_seconds INTEGER NOT NULL DEFAULT 300 CHECK (dedupe_window_seconds BETWEEN 1 AND 604800),
    variable_defaults JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (recipient_type <> 'custom' OR NULLIF(regexp_replace(COALESCE(custom_recipient, ''), '[^0-9]', '', 'g'), '') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS notification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL,
    rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL,
    sender_phone_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'retry', 'sent', 'failed', 'skipped')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider_message_id TEXT,
    last_error TEXT,
    dedupe_key TEXT NOT NULL UNIQUE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    command TEXT NOT NULL UNIQUE CHECK (command ~ '^![a-z0-9_]+$'),
    aliases TEXT[] NOT NULL DEFAULT '{}',
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    usage TEXT NOT NULL,
    handler_key TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_menu BOOLEAN NOT NULL DEFAULT TRUE,
    admin_only BOOLEAN NOT NULL DEFAULT TRUE CHECK (admin_only),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_due ON notification_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_event ON notification_jobs(event_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_rules_active ON notification_rules(is_active, event_key);
CREATE INDEX IF NOT EXISTS idx_bot_commands_menu ON bot_commands(is_active, show_in_menu, sort_order);

ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated admin access" ON notification_rules;
CREATE POLICY "Authenticated admin access" ON notification_rules FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON notification_jobs;
CREATE POLICY "Authenticated admin access" ON notification_jobs FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON bot_commands;
CREATE POLICY "Authenticated admin access" ON bot_commands FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON notification_rules;
CREATE TRIGGER set_whatsapp_manager_updated_at BEFORE UPDATE ON notification_rules FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at();
DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON notification_jobs;
CREATE TRIGGER set_whatsapp_manager_updated_at BEFORE UPDATE ON notification_jobs FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at();
DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON bot_commands;
CREATE TRIGGER set_whatsapp_manager_updated_at BEFORE UPDATE ON bot_commands FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at();

INSERT INTO templates (name, category, type, body, usage_context, is_active)
SELECT seed.name, seed.category, seed.type, seed.body, seed.usage_context, seed.is_active
FROM (VALUES
('Notif Pembayaran Customer', 'Transaksi', 'text', E'Halo Kak {{customer_name}} 👋\n\nPembayaran untuk *{{package_name}}* sebesar *Rp {{amount}}* telah berhasil kami terima. ✅\n\nOrder ID: *{{order_id}}*\nPoster dan pesanan Kakak akan segera kami proses.\n\nTerima kasih — Admin InfoLokerJombang', 'payment.paid.customer', TRUE),
('Notif Pembayaran Admin', 'Internal', 'text', E'✅ *PEMBAYARAN BERHASIL*\n\nNominal: *Rp {{amount}}*\nKlien: {{customer_name}} ({{company_name}})\nLayanan: {{package_name}}\nOrder ID: {{order_id}}\n\nPesanan sudah masuk antrean posting.', 'payment.paid.admin', TRUE),
('Notif Invoice Baru Admin', 'Internal', 'text', E'🚨 *INVOICE BARU DIBUAT*\n\nID: {{invoice_number}}\nKlien: {{customer_name}}\nTotal: Rp {{amount}}\nStatus: Menunggu Pembayaran\n\n{{invoice_url}}', 'invoice.created.admin', TRUE),
('Konfirmasi Poster Diterima', 'Transaksi', 'text', E'Halo Kak {{customer_name}} 👋\n\nPoster lowongan *{{company_name}}* sudah kami terima! ✅\n\nTim kami akan segera memproses dan menjadwalkan posting sesuai paket yang dipilih.\n\nTerima kasih — Admin InfoLokerJombang', 'poster.received.customer', TRUE)
 ,('Invoice Baru Customer', 'Transaksi', 'text', E'Halo Kak {{customer_name}} 👋\n\nBerikut invoice untuk *{{package_name}}* senilai *Rp {{amount}}*.\n\n🔗 {{payment_url}}\n\nSilakan buka link untuk melihat detail tagihan dan menyelesaikan pembayaran. Terima kasih.', 'invoice.created.customer', TRUE)
 ,('Pengingat Pembayaran Customer', 'Transaksi', 'text', E'Halo Kak {{customer_name}} 👋\n\nKami mengingatkan bahwa tagihan *{{package_name}}* senilai *Rp {{amount}}* masih menunggu pembayaran.\n\n🔗 {{payment_url}}\n\nJika sudah membayar, pesan ini dapat diabaikan. Terima kasih.', 'invoice.reminder.customer', TRUE)
) AS seed(name, category, type, body, usage_context, is_active)
WHERE NOT EXISTS (SELECT 1 FROM templates existing WHERE existing.name = seed.name);

INSERT INTO notification_rules (event_key, name, description, recipient_type, sender_role, template_id, delay_seconds, max_attempts, dedupe_window_seconds)
SELECT seed.event_key, seed.name, seed.description, seed.recipient_type, seed.sender_role, t.id, seed.delay_seconds, 3, seed.dedupe_window_seconds
FROM (VALUES
  ('payment.paid.customer', 'Pembayaran berhasil ke customer', 'Konfirmasi pembayaran diterima', 'customer', 'admin', 2, 86400, 'Notif Pembayaran Customer'),
  ('payment.paid.admin', 'Pembayaran berhasil ke admin', 'Notifikasi internal pembayaran masuk', 'admin', 'bot', 0, 86400, 'Notif Pembayaran Admin'),
  ('invoice.created.admin', 'Invoice baru ke admin', 'Notifikasi internal invoice baru', 'admin', 'bot', 0, 300, 'Notif Invoice Baru Admin'),
  ('poster.received.customer', 'Poster diterima ke customer', 'Konfirmasi poster sudah diterima', 'customer', 'admin', 2, 86400, 'Konfirmasi Poster Diterima')
  ,('invoice.created.customer', 'Invoice baru ke customer', 'Kirim invoice baru dari Admin Utama', 'customer', 'admin', 2, 86400, 'Invoice Baru Customer')
  ,('invoice.reminder.customer', 'Pengingat pembayaran ke customer', 'Kirim pengingat pembayaran dari Admin Utama', 'customer', 'admin', 2, 3600, 'Pengingat Pembayaran Customer')
) AS seed(event_key, name, description, recipient_type, sender_role, delay_seconds, dedupe_window_seconds, template_name)
JOIN templates t ON t.name = seed.template_name
ON CONFLICT (event_key) DO NOTHING;

INSERT INTO bot_commands (command, aliases, category, description, usage, handler_key, show_in_menu, sort_order)
VALUES
('!menu', ARRAY['!help'], 'Bantuan', 'Buka menu command Admin Bot', '!menu', 'menu', TRUE, 10),
('!rekap', ARRAY['!rekapan'], 'Ringkasan', 'Ringkasan transaksi dan pendapatan hari ini', '!rekap', 'rekap', TRUE, 20),
('!cek', '{}', 'Pembayaran & Invoice', 'Cek status order berdasarkan ID', '!cek INV-123', 'cek', TRUE, 30),
('!tagihan', '{}', 'Pembayaran & Invoice', 'Daftar invoice yang belum dibayar', '!tagihan', 'tagihan', TRUE, 40),
('!tagih', '{}', 'Pembayaran & Invoice', 'Kirim pengingat pembayaran ke customer', '!tagih INV-123', 'tagih', TRUE, 50),
('!buat_invoice', ARRAY['!invoice'], 'Pembayaran & Invoice', 'Buat invoice melalui form interaktif', '!buat_invoice', 'buat_invoice', TRUE, 60),
('!klien', '{}', 'Customer', 'Cari riwayat customer berdasarkan nomor WA', '!klien 628xxx', 'klien', TRUE, 70),
('!template', '{}', 'Pesan', 'Daftar atau kirim Pesan Tersimpan', '!template list', 'template', TRUE, 80),
('!notif', '{}', 'Sistem', 'Lihat status Notification Center', '!notif status', 'notif', TRUE, 90),
('!gagal', '{}', 'Sistem', 'Lihat pengiriman gagal terbaru', '!gagal', 'gagal', TRUE, 100),
('!cancel', '{}', 'Bantuan', 'Batalkan form interaktif aktif', '!cancel', 'cancel', FALSE, 900),
('!inv_lowongan', '{}', 'Internal', 'Handler tombol invoice lowongan', '!inv_lowongan', 'inv_lowongan', FALSE, 910),
('!inv_umum', '{}', 'Internal', 'Handler tombol invoice umum', '!inv_umum', 'inv_umum', FALSE, 920)
ON CONFLICT (command) DO UPDATE SET
aliases = EXCLUDED.aliases, category = EXCLUDED.category, description = EXCLUDED.description,
usage = EXCLUDED.usage, handler_key = EXCLUDED.handler_key, show_in_menu = EXCLUDED.show_in_menu,
sort_order = EXCLUDED.sort_order;
