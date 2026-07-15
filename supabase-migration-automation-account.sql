-- Tambahkan kolom phone_id pada automation
ALTER TABLE automation 
ADD COLUMN IF NOT EXISTS phone_id TEXT;
