-- Migration: Create app_settings table for storing application settings
-- Run this SQL in your Supabase SQL Editor

-- Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default Instagram stats
INSERT INTO app_settings (key, value) 
VALUES ('instagram_stats', '{"posts": "9.800+", "followers": "205rb"}')
ON CONFLICT (key) DO NOTHING;

-- Verify the table was created
SELECT * FROM app_settings;
