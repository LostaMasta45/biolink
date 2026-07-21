-- Backfill media metadata for histories that were synced before Inbox rendered
-- attachments. The existing cursor-based worker will resume safely in batches.

UPDATE wa_inbox_sync_state
SET cursor = NULL,
    last_success_at = NULL,
    last_error = NULL,
    updated_at = NOW()
WHERE resource = 'messages';
