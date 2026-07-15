-- Tambahkan kolom usage_context pada templates
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS usage_context TEXT;
