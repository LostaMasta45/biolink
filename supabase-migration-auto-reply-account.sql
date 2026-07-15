-- Tambahkan kolom phone_id pada auto_reply
ALTER TABLE auto_reply 
ADD COLUMN IF NOT EXISTS phone_id TEXT;
