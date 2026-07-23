-- The WhatsApp 24-hour service window belongs to a conversation with one
-- sending business account. The same contact may message both Admin Utama and
-- Bot, so activity must be recorded separately for each sender account.
BEGIN;

ALTER TABLE whatsapp_contact_activity
  DROP CONSTRAINT IF EXISTS whatsapp_contact_activity_pkey;

ALTER TABLE whatsapp_contact_activity
  ADD CONSTRAINT whatsapp_contact_activity_pkey PRIMARY KEY (customer, sender_phone_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_activity_sender_last_inbound
  ON whatsapp_contact_activity(sender_phone_id, last_inbound_at DESC);

COMMIT;
