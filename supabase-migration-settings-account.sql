-- Tambahan kolom untuk menyimpan nomor Admin Utama dan Bot 
-- agar tidak tergantung penuh pada .env

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS admin_phone_id TEXT,
ADD COLUMN IF NOT EXISTS admin_phone_number TEXT,
ADD COLUMN IF NOT EXISTS bot_phone_id TEXT,
ADD COLUMN IF NOT EXISTS bot_phone_number TEXT;
