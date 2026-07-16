-- KirimDev/Meta compliant message composer fields.
-- Safe to run repeatedly in Supabase SQL Editor.

ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS header_type TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS preview_url BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS filename TEXT,
    ADD COLUMN IF NOT EXISTS list_button_text TEXT NOT NULL DEFAULT 'Lihat pilihan',
    ADD COLUMN IF NOT EXISTS carousel_cards JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;
ALTER TABLE templates ADD CONSTRAINT templates_type_check
    CHECK (type IN ('text', 'image', 'video', 'audio', 'document', 'reply_button', 'url_button', 'list', 'carousel'));
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_header_type_check;
ALTER TABLE templates ADD CONSTRAINT templates_header_type_check
    CHECK (header_type IN ('none', 'text', 'image', 'video', 'document'));

ALTER TABLE settings
    ADD COLUMN IF NOT EXISTS auto_mark_read BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS show_typing_indicator BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve existing interactive header data while making its type explicit.
UPDATE templates
SET header_type = CASE
    WHEN type IN ('reply_button', 'url_button') AND NULLIF(media_url, '') IS NOT NULL AND LOWER(media_url) ~ '\.(mp4|3gp)(\?|$)' THEN 'video'
    WHEN type IN ('reply_button', 'url_button') AND NULLIF(media_url, '') IS NOT NULL AND LOWER(media_url) ~ '\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?|$)' THEN 'document'
    WHEN type IN ('reply_button', 'url_button') AND NULLIF(media_url, '') IS NOT NULL THEN 'image'
    WHEN type IN ('reply_button', 'url_button', 'list') AND NULLIF(header, '') IS NOT NULL THEN 'text'
    ELSE 'none'
END
WHERE header_type = 'none';

COMMENT ON COLUMN templates.header_type IS 'Interactive only: none/text/image/video/document. List supports none/text.';
COMMENT ON COLUMN templates.preview_url IS 'Text messages only; asks Meta to render a URL preview.';
COMMENT ON COLUMN templates.carousel_cards IS 'KirimDev interactive carousel cards, 2-10 items.';
COMMENT ON COLUMN settings.auto_mark_read IS 'Marks inbound wamid as read after webhook persistence.';
