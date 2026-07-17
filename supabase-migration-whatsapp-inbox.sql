-- WhatsApp Inbox read model + Balas Cepat untuk ILJ Hub.
-- Jalankan setelah migration WhatsApp Manager dan Flow Execution.
-- Browser tidak diberi akses langsung: seluruh akses melewati API admin server-side.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS wa_inbox_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  label TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'bot')),
  is_customer_inbox BOOLEAN NOT NULL DEFAULT FALSE,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_inbox_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_inbox_accounts(id) ON DELETE CASCADE,
  provider_contact_id TEXT,
  recipient_key TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  bsuid TEXT,
  name TEXT,
  profile_name TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wa_account_id, recipient_key)
);

CREATE TABLE IF NOT EXISTS wa_inbox_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_inbox_accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES wa_inbox_contacts(id) ON DELETE CASCADE,
  provider_conversation_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_user_id UUID,
  unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  needs_reply BOOLEAN NOT NULL DEFAULT TRUE,
  last_message_preview TEXT,
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  service_window_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wa_account_id, contact_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_inbox_conversations_provider
  ON wa_inbox_conversations(wa_account_id, provider_conversation_id)
  WHERE provider_conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_list
  ON wa_inbox_conversations(wa_account_id, status, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_conversations_reply
  ON wa_inbox_conversations(wa_account_id, needs_reply, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS wa_inbox_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shortcut),
  UNIQUE (template_id)
);

CREATE TABLE IF NOT EXISTS wa_inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_inbox_accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES wa_inbox_conversations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES wa_inbox_contacts(id) ON DELETE CASCADE,
  provider_message_id TEXT UNIQUE,
  provider_wamid TEXT,
  client_request_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  source TEXT NOT NULL DEFAULT 'provider' CHECK (source IN ('manual_inbox', 'quick_reply', 'auto_reply', 'notification', 'flow', 'provider', 'app')),
  quick_reply_id UUID REFERENCES wa_inbox_quick_replies(id) ON DELETE SET NULL,
  reply_to_provider_wamid TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_filename TEXT,
  sender_user_id UUID,
  error_code TEXT,
  error_message TEXT,
  provider_created_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wa_account_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_timeline
  ON wa_inbox_messages(conversation_id, provider_created_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_inbox_messages_status
  ON wa_inbox_messages(provider_message_id, status)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS wa_inbox_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_account_id UUID NOT NULL REFERENCES wa_inbox_accounts(id) ON DELETE CASCADE,
  provider_label_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wa_account_id, name)
);

CREATE TABLE IF NOT EXISTS wa_inbox_conversation_labels (
  conversation_id UUID NOT NULL REFERENCES wa_inbox_conversations(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES wa_inbox_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, label_id)
);

CREATE TABLE IF NOT EXISTS wa_inbox_sync_state (
  wa_account_id UUID NOT NULL REFERENCES wa_inbox_accounts(id) ON DELETE CASCADE,
  resource TEXT NOT NULL CHECK (resource IN ('conversations', 'messages', 'contacts')),
  cursor TEXT,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wa_account_id, resource)
);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'wa_inbox_accounts', 'wa_inbox_contacts', 'wa_inbox_conversations',
    'wa_inbox_quick_replies', 'wa_inbox_messages', 'wa_inbox_labels', 'wa_inbox_sync_state'
  ] LOOP
    EXECUTE FORMAT('DROP TRIGGER IF EXISTS set_whatsapp_manager_updated_at ON %I', table_name);
    EXECUTE FORMAT('CREATE TRIGGER set_whatsapp_manager_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_whatsapp_manager_updated_at()', table_name);
  END LOOP;
END $$;

ALTER TABLE wa_inbox_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbox_sync_state ENABLE ROW LEVEL SECURITY;

-- Tidak ada policy authenticated umum. Server API memverifikasi sesi lalu memakai
-- service-role untuk read model ini; data chat tidak pernah diekspos langsung dari browser.
