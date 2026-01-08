-- Migration: Add missing columns to invoices table
-- Run this SQL in your Supabase SQL Editor

-- Add sender info columns (if not exist)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sender_address TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sender_contact TEXT;

-- Add color_theme column (if not exist)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'default';

-- Add logo_url column (if not exist)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'invoices'
ORDER BY ordinal_position;
