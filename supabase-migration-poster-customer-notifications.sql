-- Notifikasi poster masuk antrean dan laporan aktivitas customer ke Admin Utama.
INSERT INTO templates (name, category, type, body, usage_context, is_active)
SELECT seed.name, seed.category, seed.type, seed.body, seed.usage_context, TRUE
FROM (VALUES
  ('Poster Masuk Antrean Customer', 'Transaksi', 'text', E'Halo Kak {{customer_name}} 👋\n\nPoster lowongan *{{company_name}}* sudah kami terima dan sudah masuk *antrean posting*. ✅\n\nPaket: *{{package_name}}*\nJumlah poster: *{{poster_count}}*\nTarget jadwal: *{{scheduled_date}}*\n\nTim kami akan mengecek materi lalu menerbitkannya sesuai antrean. Terima kasih — Admin InfoLokerJombang', 'poster.received.customer'),
  ('Laporan Poster Masuk Admin', 'Internal', 'text', E'🖼️ *POSTER MASUK ANTREAN*\n\nKlien: {{customer_name}} ({{company_name}})\nPaket: {{package_name}}\nJumlah poster: {{poster_count}}\nOrder ID: {{order_id}}\nTarget jadwal: {{scheduled_date}}\n\nStatus antrean: siap diproses.', 'poster.received.admin')
) AS seed(name, category, type, body, usage_context)
WHERE NOT EXISTS (SELECT 1 FROM templates existing WHERE existing.name = seed.name);

INSERT INTO notification_rules (event_key, name, description, recipient_type, sender_role, template_id, delay_seconds, max_attempts, dedupe_window_seconds)
SELECT seed.event_key, seed.name, seed.description, seed.recipient_type, seed.sender_role, template.id, seed.delay_seconds, 3, seed.dedupe_window_seconds
FROM (VALUES
  ('poster.received.customer', 'Poster masuk antrean ke customer', 'Konfirmasi materi diterima dan masuk antrean', 'customer', 'admin', 2, 86400, 'Poster Masuk Antrean Customer'),
  ('poster.received.admin', 'Laporan poster masuk ke admin', 'Bot melaporkan poster customer yang masuk antrean', 'admin', 'bot', 0, 86400, 'Laporan Poster Masuk Admin')
) AS seed(event_key, name, description, recipient_type, sender_role, delay_seconds, dedupe_window_seconds, template_name)
JOIN templates template ON template.name = seed.template_name
ON CONFLICT (event_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  recipient_type = EXCLUDED.recipient_type,
  sender_role = EXCLUDED.sender_role,
  template_id = EXCLUDED.template_id,
  delay_seconds = EXCLUDED.delay_seconds,
  max_attempts = EXCLUDED.max_attempts,
  dedupe_window_seconds = EXCLUDED.dedupe_window_seconds,
  is_active = TRUE;
