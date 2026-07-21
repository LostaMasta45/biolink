-- Make an Auto Reply keyword optionally available as an Inbox quick-reply shortcut.
-- Existing rules remain available by default so their text fallback can be reused
-- without creating a second, divergent message record.

ALTER TABLE auto_reply
  ADD COLUMN IF NOT EXISTS inbox_quick_reply_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN auto_reply.inbox_quick_reply_enabled IS
  'Expose this active text Auto Reply as /keyword in the WhatsApp Inbox composer.';
