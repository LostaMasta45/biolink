-- WhatsApp Automation v2: match mode, durable delay queue, cooldown,
-- priority, business hours/handover, test mode, and complete audit trail.
-- Safe to run repeatedly in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE auto_reply
    ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'equals',
    ADD COLUMN IF NOT EXISTS delay_seconds INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS schedule_mode TEXT NOT NULL DEFAULT 'always',
    ADD COLUMN IF NOT EXISTS handover_to_human BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS handover_duration_minutes INTEGER NOT NULL DEFAULT 480,
    ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS test_phone_numbers TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_match_type_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_match_type_check
    CHECK (match_type IN ('equals', 'contains', 'starts_with'));
ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_delay_seconds_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_delay_seconds_check
    CHECK (delay_seconds BETWEEN 0 AND 30);
ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_cooldown_seconds_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_cooldown_seconds_check
    CHECK (cooldown_seconds BETWEEN 0 AND 86400);
ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_priority_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_priority_check
    CHECK (priority BETWEEN -1000 AND 1000);
ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_schedule_mode_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_schedule_mode_check
    CHECK (schedule_mode IN ('always', 'business_hours', 'outside_hours'));
ALTER TABLE auto_reply DROP CONSTRAINT IF EXISTS auto_reply_handover_duration_check;
ALTER TABLE auto_reply ADD CONSTRAINT auto_reply_handover_duration_check
    CHECK (handover_duration_minutes BETWEEN 1 AND 10080);

ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS business_hours_start TIME NOT NULL DEFAULT '08:00',
    ADD COLUMN IF NOT EXISTS business_hours_end TIME NOT NULL DEFAULT '17:00',
    ADD COLUMN IF NOT EXISTS business_days SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6]::SMALLINT[];

ALTER TABLE logs DROP CONSTRAINT IF EXISTS logs_status_check;
ALTER TABLE logs ADD CONSTRAINT logs_status_check
    CHECK (status IN ('success', 'failed', 'pending', 'skipped'));

CREATE TABLE IF NOT EXISTS webhook_event_receipts (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_reply_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT,
    rule_id UUID NOT NULL REFERENCES auto_reply(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    customer TEXT NOT NULL,
    sender_phone_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'retry', 'sent', 'failed', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    provider_message_id TEXT,
    last_error TEXT,
    dedupe_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS whatsapp_handover_sessions (
    customer TEXT PRIMARY KEY,
    rule_id UUID REFERENCES auto_reply(id) ON DELETE SET NULL,
    reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_matching
    ON auto_reply(is_active, match_type, priority DESC);
CREATE INDEX IF NOT EXISTS idx_auto_reply_jobs_due
    ON auto_reply_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_auto_reply_jobs_customer_rule
    ON auto_reply_jobs(customer, rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_reply_jobs_provider_message
    ON auto_reply_jobs(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_receipts_received_at
    ON webhook_event_receipts(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_handover_expires_at
    ON whatsapp_handover_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_logs_event_created
    ON logs(event_type, created_at DESC);

ALTER TABLE auto_reply_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_event_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_handover_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated admin access" ON auto_reply_jobs;
CREATE POLICY "Authenticated admin access" ON auto_reply_jobs
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON webhook_event_receipts;
CREATE POLICY "Authenticated admin access" ON webhook_event_receipts
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON whatsapp_handover_sessions;
CREATE POLICY "Authenticated admin access" ON whatsapp_handover_sessions
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON auto_reply_jobs;
CREATE TRIGGER set_whatsapp_manager_updated_at
    BEFORE UPDATE ON auto_reply_jobs FOR EACH ROW
    EXECUTE FUNCTION set_whatsapp_manager_updated_at();
DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON whatsapp_handover_sessions;
CREATE TRIGGER set_whatsapp_manager_updated_at
    BEFORE UPDATE ON whatsapp_handover_sessions FOR EACH ROW
    EXECUTE FUNCTION set_whatsapp_manager_updated_at();

-- Retain only recent deduplication receipts; run periodically if desired.
CREATE OR REPLACE FUNCTION cleanup_whatsapp_automation_audit()
RETURNS void AS $$
BEGIN
    DELETE FROM webhook_event_receipts WHERE received_at < NOW() - INTERVAL '7 days';
    DELETE FROM whatsapp_handover_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
