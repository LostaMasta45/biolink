-- ============================================
-- Bot Sessions Table (For WA State Machine)
-- ============================================

CREATE TABLE IF NOT EXISTS bot_sessions (
    phone_id TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    state TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (phone_id, sender_phone)
);

-- RLS
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on bot_sessions"
    ON bot_sessions FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow public all on bot_sessions"
    ON bot_sessions FOR ALL
    USING (true)
    WITH CHECK (true);
