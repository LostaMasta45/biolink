-- WhatsApp Automation Manager
-- Migration baru ini sengaja tidak mengubah tabel `whatsapp_templates` lama
-- karena tabel tersebut masih digunakan oleh command processor ILJ Hub.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'reply_button', 'url_button', 'list', 'carousel')),
    header TEXT,
    header_type TEXT NOT NULL DEFAULT 'none' CHECK (header_type IN ('none', 'text', 'image', 'video', 'document')),
    body TEXT NOT NULL,
    footer TEXT,
    media_url TEXT,
    preview_url BOOLEAN NOT NULL DEFAULT FALSE,
    filename TEXT,
    list_button_text TEXT NOT NULL DEFAULT 'Lihat pilihan',
    buttons JSONB NOT NULL DEFAULT '[]'::JSONB,
    sections JSONB NOT NULL DEFAULT '[]'::JSONB,
    carousel_cards JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    condition_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    action_type TEXT NOT NULL,
    action_config JSONB NOT NULL DEFAULT '{}'::JSONB,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    automation_id UUID REFERENCES automation(id) ON DELETE SET NULL,
    next_node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (flow_id, position)
);

CREATE TABLE IF NOT EXISTS auto_reply (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT NOT NULL,
    template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (keyword)
);

CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer TEXT NOT NULL,
    event_type TEXT NOT NULL,
    automation_id UUID REFERENCES automation(id) ON DELETE SET NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
    message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    event_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retry')),
    latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
    id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
    api_key TEXT,
    webhook_url TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    retry_count INTEGER NOT NULL DEFAULT 3 CHECK (retry_count BETWEEN 0 AND 10),
    default_delay INTEGER NOT NULL DEFAULT 0 CHECK (default_delay >= 0),
    debug_mode BOOLEAN NOT NULL DEFAULT FALSE,
    auto_mark_read BOOLEAN NOT NULL DEFAULT FALSE,
    show_typing_indicator BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_template ON automation(template_id);
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow_position ON flow_nodes(flow_id, position);
CREATE INDEX IF NOT EXISTS idx_auto_reply_keyword ON auto_reply(LOWER(keyword));
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_filters ON logs(status, automation_id, customer);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event_type, status);

CREATE OR REPLACE FUNCTION set_whatsapp_manager_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['templates', 'automation', 'flows', 'flow_nodes', 'auto_reply', 'settings']
    LOOP
        EXECUTE FORMAT('DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON %I', table_name);
        EXECUTE FORMAT(
            'CREATE TRIGGER set_whatsapp_manager_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at()',
            table_name
        );
    END LOOP;
END $$;

-- Jalankan juga `supabase-migration-whatsapp-automation-v2.sql` setelah migration
-- ini untuk fitur automation produksi: match mode, queue/delay, cooldown,
-- deduplication, priority, jam kerja/handover, test mode, dan audit API lengkap.

-- Webhook tidak mempunyai sesi admin. Batasi akses anon hanya untuk membaca rule
-- dan template aktif yang diperlukan oleh execution engine. INSERT/UPDATE/DELETE
-- tetap dilindungi policy admin di atas.
DROP POLICY IF EXISTS "Webhook reads active auto replies" ON auto_reply;
CREATE POLICY "Webhook reads active auto replies"
ON auto_reply FOR SELECT TO anon
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Webhook reads active templates" ON templates;
CREATE POLICY "Webhook reads active templates"
ON templates FOR SELECT TO anon
USING (is_active = TRUE);

INSERT INTO settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['templates', 'automation', 'flows', 'flow_nodes', 'auto_reply', 'logs', 'webhook_logs', 'settings']
    LOOP
        EXECUTE FORMAT('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = table_name
              AND policyname = 'Authenticated admin access'
        ) THEN
            EXECUTE FORMAT(
                'CREATE POLICY "Authenticated admin access" ON %I FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE)',
                table_name
            );
        END IF;
    END LOOP;
END $$;
