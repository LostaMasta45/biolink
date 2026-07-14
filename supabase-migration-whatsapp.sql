-- ============================================
-- WhatsApp Templates Table
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_code ON whatsapp_templates(code);

-- RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on whatsapp_templates"
    ON whatsapp_templates FOR SELECT
    USING (true);

CREATE POLICY "Admin full access on whatsapp_templates"
    ON whatsapp_templates FOR ALL
    USING (auth.role() = 'authenticated');

-- Insert Initial Data
INSERT INTO whatsapp_templates (code, name, content)
VALUES 
('T-HARGA', 'Daftar Harga', 'Berikut adalah daftar harga layanan Infolokerjombang:\n1. Premium Posting - Rp 150.000\n2. Loker Highlight - Rp 250.000\n3. Broadcast Telegram - Rp 100.000\n\nSilakan pilih layanan yang Anda butuhkan.'),
('T-SYARAT', 'Syarat & Ketentuan', 'Syarat dan Ketentuan Posting Loker:\n1. Tidak mengandung unsur SARA\n2. Deskripsi loker jelas (Posisi, Syarat, Cara Melamar)\n3. Menyertakan gambar/poster (opsional)'),
('T-PROMO', 'Promo Bulan Ini', '🎉 *PROMO SPESIAL BULAN INI* 🎉\n\nDapatkan diskon 20% untuk pembelian paket *Loker Highlight* dengan menggunakan kode voucher: *ILJPROMO20*.\n\nBerlaku sampai akhir bulan ini!')
ON CONFLICT (code) DO NOTHING;
