-- Tambahkan rute Admin Utama -> Bot pada Notification Center.
-- Jalankan setelah supabase-migration-whatsapp-notification-center.sql.

ALTER TABLE notification_rules
  DROP CONSTRAINT IF EXISTS notification_rules_recipient_type_check;

ALTER TABLE notification_rules
  ADD CONSTRAINT notification_rules_recipient_type_check
  CHECK (recipient_type IN ('customer', 'admin', 'bot', 'custom'));
