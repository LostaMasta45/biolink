-- Flow Map execution engine
-- Jalankan setelah supabase-migration-whatsapp-manager.sql.

ALTER TABLE flow_nodes
    ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'send_and_wait'
        CHECK (execution_mode IN ('send_and_wait', 'send_and_continue', 'wait_for_reply', 'complete')),
    ADD COLUMN IF NOT EXISTS delay_seconds INTEGER NOT NULL DEFAULT 0
        CHECK (delay_seconds BETWEEN 0 AND 86400),
    ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION NOT NULL DEFAULT 320,
    ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE flow_nodes
SET position_x = 320,
    position_y = position * 170
WHERE position_x = 320 AND position_y = 0 AND position > 0;

CREATE TABLE IF NOT EXISTS flow_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'message_received', 'chat_started', 'conversation_closed',
        'conversation_assigned', 'label_added', 'window_expiring', 'chat_inactive'
    )),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_triggers_active_event
    ON flow_triggers(trigger_type, is_active, priority DESC);

CREATE TABLE IF NOT EXISTS flow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    customer TEXT NOT NULL,
    sender_phone_id TEXT NOT NULL,
    trigger_rule_id UUID REFERENCES auto_reply(id) ON DELETE SET NULL,
    trigger_id UUID REFERENCES flow_triggers(id) ON DELETE SET NULL,
    entry_event_id TEXT,
    current_node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'waiting', 'completed', 'failed', 'cancelled')),
    context JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_run_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
    node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'waiting', 'pending_delivery', 'delivered', 'read', 'completed', 'failed', 'skipped')),
    input_text TEXT,
    provider_message_id TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (run_id, sequence)
);

CREATE TABLE IF NOT EXISTS whatsapp_contact_activity (
    customer TEXT PRIMARY KEY,
    sender_phone_id TEXT NOT NULL,
    last_inbound_at TIMESTAMPTZ NOT NULL,
    last_inbound_event_id TEXT,
    last_inbound_text TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_trigger_firings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id UUID NOT NULL REFERENCES flow_triggers(id) ON DELETE CASCADE,
    customer TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_runs
    ADD COLUMN IF NOT EXISTS trigger_id UUID REFERENCES flow_triggers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_flow_runs_customer_status
    ON flow_runs(customer, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_created
    ON flow_runs(flow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_run_steps_provider_message
    ON flow_run_steps(provider_message_id)
    WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_flow_run_steps_run_sequence
    ON flow_run_steps(run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_activity_last_inbound
    ON whatsapp_contact_activity(last_inbound_at);
CREATE INDEX IF NOT EXISTS idx_flow_trigger_firings_trigger_customer
    ON flow_trigger_firings(trigger_id, customer, fired_at DESC);

ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contact_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_trigger_firings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated admin access" ON flow_runs;
CREATE POLICY "Authenticated admin access" ON flow_runs
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON flow_run_steps;
CREATE POLICY "Authenticated admin access" ON flow_run_steps
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON flow_triggers;
CREATE POLICY "Authenticated admin access" ON flow_triggers
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON whatsapp_contact_activity;
CREATE POLICY "Authenticated admin access" ON whatsapp_contact_activity
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Authenticated admin access" ON flow_trigger_firings;
CREATE POLICY "Authenticated admin access" ON flow_trigger_firings
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON flow_runs;
CREATE TRIGGER set_whatsapp_manager_updated_at
    BEFORE UPDATE ON flow_runs
    FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at();
DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON flow_triggers;
CREATE TRIGGER set_whatsapp_manager_updated_at
    BEFORE UPDATE ON flow_triggers
    FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at();
