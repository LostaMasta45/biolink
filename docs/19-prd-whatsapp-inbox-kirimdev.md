# PRD — WhatsApp Inbox KirimDev untuk ILJ-Hub

## 1. Keputusan produk

Bangun **WhatsApp Inbox** sebagai modul kerja Customer Service di dalam dashboard ILJ-Hub yang sudah ada. Inbox adalah sumber tampilan utama untuk percakapan customer; KirimDev tetap menjadi provider pengiriman, penerimaan, media, dan status delivery.

Modul ini **bukan** dashboard kedua dan tidak menggantikan Auto Reply, Notification Center, Invoice, atau Admin Bot.

### Prinsip khusus ILJ-Hub

- Nomor **Admin Utama** adalah satu-satunya nomor customer-facing di Inbox MVP.
- Nomor **Bot** hanya untuk Admin Utama menjalankan command internal (`!menu`, `!buat_invoice`, dan lain-lain); pesan Bot tidak dicampur ke inbox customer.
- Customer yang masuk ke Admin Utama harus lebih dulu disimpan/di-update pada Inbox, lalu boleh diproses Auto Reply yang sudah ada.
- Balasan manual CS dikirim dari Admin Utama. Bot tidak pernah menjadi pengirim balasan manual customer.
- Supabase adalah read model lokal untuk UI; KirimDev bukan data source yang dipanggil pada setiap render halaman.

## 2. Analisis dokumen awal

Dokumen `PROMPT_CODEX_WHATSAPP_INBOX_KIRIMDEV.md` memiliki arah yang baik: local read model, webhook idempoten, HMAC, status pesan, realtime, dan batas 24 jam adalah keputusan yang tepat.

Penyesuaian wajib untuk repository ini:

1. **Jangan membuat endpoint webhook baru.** Gunakan dan perluas `POST /api/webhook/whatsapp`, yang sudah memiliki HMAC, deduplikasi, audit log, routing dua nomor, dan Auto Reply.
2. **Jangan memaksakan tenant/organization.** ILJ-Hub saat ini adalah satu bisnis dengan dua akun WA. Gunakan `wa_account_id` sebagai scope data; desain dapat ditambah tenant kelak tanpa mengubah MVP.
3. **Jangan mengandalkan field API yang belum diverifikasi.** Client KirimDev inbox harus typed dari respons aktual/OpenAPI; schema normalisasi harus tahan field tambahan.
4. **Jangan mencampurkan Bot dan customer.** Filter default Inbox hanya `Admin Utama`; event command Bot tetap berada pada Activity/API Logs.
5. **Jangan menggandakan audit yang ada.** `logs`, `webhook_logs`, dan `webhook_event_receipts` tetap dipakai; tabel Inbox menyimpan data percakapan, bukan log diagnostik kedua.
6. **RLS saat ini perlu diperketat sebelum multi-user.** Akses Inbox tidak boleh memakai policy `USING (TRUE)` untuk semua user authenticated.

## 3. Sasaran dan metrik keberhasilan

### Sasaran MVP

CS dapat membuka satu halaman, melihat customer yang menunggu jawaban, membaca riwayat lokal, mengirim balasan teks dari Admin Utama, serta mengetahui apakah pesan gagal/terkirim/dibaca.

### Metrik penerimaan

- Pesan inbound tampil di Inbox paling lambat 5 detik setelah webhook valid diterima.
- Pesan outbound hanya dibuat satu kali untuk satu `client_request_id`.
- Delivery status tidak pernah mundur dari `read` ke `delivered`/`sent`.
- Semua action kirim, retry, mark-read, assignment, dan perubahan status memiliki audit entry.
- Pesan ke Bot dan command internal tidak muncul pada filter customer default.

## 4. Ruang lingkup

### MVP (wajib)

- Daftar percakapan Admin Utama: semua, belum dibaca, perlu balasan, open, pending, resolved.
- Pencarian lokal menurut nama/nomor/preview pesan; pencarian isi riwayat penuh dapat menjadi fase berikutnya jika full-text belum tersedia.
- Panel chat dengan pagination cursor/keyset untuk riwayat lama.
- Kirim pesan teks, reply-to, retry pesan gagal, dan optimistic pending message.
- Status `pending`, `sent`, `delivered`, `read`, `failed`.
- Mark message as read; hormati setting existing `auto_mark_read` dan `show_typing_indicator`.
- Status percakapan `open`, `pending`, `resolved`; prioritas `low`, `normal`, `high`, `urgent`.
- Label lokal dan penanggung jawab internal (hanya bila user admin/staff sudah tersedia).
- Quick reply dari Pesan Tersimpan existing; tidak membuat penyimpanan template kedua.
- Realtime Supabase untuk perubahan conversation/message lokal.
- Indikator jendela layanan 24 jam dan blok pengiriman free-form jika telah berakhir.
- Webhook sync untuk `message.received`, `message.sent`, `message.status`, `conversation.assigned`, `conversation.closed`, `contact.created`, `contact.updated`, dan `contact.identity_updated`.
- Initial/backfill sync manual per akun dengan cursor dan checkpoint.

### Bukan MVP

- Broadcast/campaign, chatbot AI, SLA analytics, merge contact, export chat, voice call, dan assignment multi-team KirimDev.
- Composer media upload penuh. MVP boleh menampilkan media inbound yang sudah dipasang KirimDev sebagai metadata/link aman.
- Multi-tenant, kecuali bisnis benar-benar mulai mengelola nomor WA milik tenant lain.

## 5. Alur sistem

```text
Customer → Admin Utama → KirimDev signed webhook
         → /api/webhook/whatsapp
         → verifikasi HMAC + event-id dedupe
         → upsert account/contact/conversation/message Inbox
         → audit + Supabase Realtime
         → Auto Reply existing (bila rule cocok)
         → Dashboard Inbox

CS → Dashboard Inbox → API admin server-side
   → permission + 24h check + idempotency key
   → local pending message
   → KirimDev POST /{phone_number_id}/messages
   → reconcile provider id/status + audit + realtime
```

Untuk `message.status`, perubahan status memakai state machine monotonik:

```text
pending → sent → delivered → read
pending/sent/delivered → failed
```

Event terlambat hanya boleh menambah informasi timestamp, bukan menurunkan status final.

## 6. UX dan navigasi

Tambahkan menu **Inbox** di dalam kelompok WhatsApp Manager, bukan sidebar aplikasi baru.

### Desktop

1. Sidebar filter dan account scope.
2. Daftar conversation dengan unread badge, priority, assignee, preview, dan waktu terakhir.
3. Panel chat dengan header customer, status 24 jam, timeline, composer, dan panel detail.

### Mobile

- Tampilan bertahap: daftar → chat → detail.
- Composer tetap mudah dipakai, tanpa layout tiga panel yang dipaksakan.

### Guardrail UX

- Tombol kirim disabled saat request sedang berjalan atau jendela 24 jam berakhir.
- Saat jendela berakhir, tampilkan alasan dan CTA ke Pesan Tersimpan/template yang disetujui pada fase berikutnya; jangan diam-diam mengirim.
- Pesan yang dikirim automation diberi penanda sumber `auto_reply`; pesan manual diberi `manual_inbox`.
- Bot/internal tidak muncul secara default; hanya diagnostik admin bila diperlukan.

## 7. Data model Supabase

Nama tabel berikut adalah kontrak MVP. Semua tabel memakai UUID internal, `created_at`, `updated_at`, trigger existing `set_whatsapp_manager_updated_at()`, RLS, dan index.

### `wa_inbox_accounts`

- `id`, `phone_number_id` (unique), `phone_number`, `label`, `role` (`admin` | `bot`), `is_customer_inbox`, `last_synced_at`, `metadata`.
- Seed dari Settings existing. Hanya akun Admin Utama yang `is_customer_inbox = true` pada MVP.

### `wa_inbox_contacts`

- `id`, `wa_account_id`, `provider_contact_id` nullable, `recipient_key`, `phone_number`, `bsuid` nullable, `name`, `profile_name`, `metadata`, `last_synced_at`.
- Unique: `(wa_account_id, recipient_key)`; simpan BSUID agar perubahan identitas provider tidak memecah histori.

### `wa_inbox_conversations`

- `id`, `wa_account_id`, `contact_id`, `provider_conversation_id` nullable, `status`, `priority`, `assigned_user_id` nullable, `unread_count`, `needs_reply`, `last_message_preview`, `last_message_at`, `last_inbound_at`, `last_outbound_at`, `service_window_expires_at`, `metadata`.
- Unique parsial untuk `(wa_account_id, provider_conversation_id)` bila tersedia; fallback conversation lokal ditautkan saat event/provider data datang.
- Index utama: `(wa_account_id, status, last_message_at DESC)`, `(wa_account_id, needs_reply, last_message_at DESC)`, `(assigned_user_id, last_message_at DESC)`.

### `wa_inbox_messages`

- `id`, `wa_account_id`, `conversation_id`, `contact_id`, `provider_message_id` nullable, `provider_wamid` nullable, `client_request_id` nullable, `direction`, `message_type`, `body`, `status`, `source`, `reply_to_provider_wamid`, `media_url`, `media_mime_type`, `media_filename`, `sender_user_id`, `error_code`, `error_message`, `provider_created_at`, `sent_at`, `delivered_at`, `read_at`, `failed_at`, `payload`.
- `direction`: `inbound | outbound | system`; `source`: `manual_inbox | auto_reply | notification | provider | app`.
- Unique parsial pada provider ID/wamid dan unique `(wa_account_id, client_request_id)` untuk mencegah klik ganda.
- Index keyset: `(conversation_id, provider_created_at DESC, created_at DESC)`.

### `wa_inbox_labels` dan `wa_inbox_conversation_labels`

- Label lokal dulu; `provider_label_id` nullable untuk sinkronisasi KirimDev nanti.
- Nama label unique per account, bukan global.

### `wa_inbox_quick_replies`

- Hanya menyimpan referensi ke `templates.id` existing, urutan, dan optional shortcut.
- Isi pesan tetap berasal dari Pesan Tersimpan existing agar copywriting tidak terduplikasi.

### `wa_inbox_sync_state`

- `wa_account_id`, `resource` (`conversations | messages | contacts`), `cursor`, `last_success_at`, `last_error`, `updated_at`.
- Tidak menyimpan cursor di browser.

Tidak perlu tabel raw webhook baru: gunakan `webhook_event_receipts` untuk dedupe dan `webhook_logs` yang sudah ada. Payload yang disimpan untuk Inbox harus diminimalkan/redacted, bukan seluruh secret/header.

## 8. API dan service boundary

Semua endpoint berada pada `src/app/api/admin/whatsapp/inbox/**` dan memverifikasi session serta permission server-side.

| Endpoint | Fungsi |
| --- | --- |
| `GET /conversations` | filter, search, keyset cursor, account scope Admin Utama default |
| `GET /conversations/:id/messages` | riwayat keyset cursor |
| `PATCH /conversations/:id` | status, priority, assignee |
| `POST /conversations/:id/messages` | kirim manual dengan `client_request_id` |
| `POST /messages/:id/retry` | retry hanya pesan failed yang aman |
| `POST /messages/:id/read` | mark-read provider + update lokal |
| `PUT /conversations/:id/labels` | tambah/hapus label lokal/provider bila tersedia |
| `POST /sync` | initial/incremental sync manual, job terkontrol |

Server service memakai client KirimDev existing yang diperluas. Client Component tidak boleh mengetahui API key, service role, atau webhook secret.

## 9. Webhook dan konsistensi

Perluas webhook existing, jangan mengganti perilaku Auto Reply/Admin Bot.

Urutan inbound customer:

1. Baca raw body dan verifikasi `X-Kirim-Signature` menggunakan secret aktif/rotasi.
2. Dedupe `X-Kirim-Event-Id`/event provider.
3. Normalisasi envelope Meta atau KirimDev-native.
4. Tentukan account memakai `metadata.phone_number_id` atau `data.session`.
5. Abaikan Bot dari customer Inbox MVP, tetapi audit tetap ada.
6. Upsert contact, conversation, inbound message, unread count, `needs_reply`, dan `service_window_expires_at = inbound_time + 24 jam`.
7. Publish perubahan melalui tabel Supabase; setelah persistence sukses baru jalankan Auto Reply existing.
8. Balas 2xx cepat; pekerjaan sync/media berat masuk queue/job.

`message.sent` diperlukan untuk mengaitkan `msg_…` dengan `wamid`. `message.status` mengubah status berdasarkan urutan state, bukan urutan waktu arrival.

## 10. Keamanan dan permission

- `KIRIMDEV_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, dan webhook secret server-only.
- Gunakan `KIRIMDEV_WEBHOOK_SECRETS` untuk rotasi, dengan fallback kompatibel ke `KIRIMDEV_WEBHOOK_SECRET` existing.
- Webhook signature HMAC SHA-256, toleransi maksimum 300 detik, comparison constant-time, dan log `webhook.invalid_signature` tanpa body sensitif.
- Tidak ada policy RLS `USING (TRUE)` untuk tabel Inbox. Policy wajib berbasis role admin/staff yang eksplisit.
- Sebelum menambah user staff, buat role/allowlist yang nyata; kondisi saat ini hanya memiliki satu akun auth, sehingga jangan menjadikan policy authenticated umum sebagai desain akhir.
- Semua send memakai `client_request_id` dan rate limit per user/conversation jika fasilitas limiter tersedia.
- Sanitasi body untuk render plain text; jangan render HTML mentah. Media hanya lewat URL provider yang tervalidasi.

## 11. Realtime dan performa

- Subscribe Supabase Realtime hanya ke conversation aktif dan daftar account terpilih.
- Jangan polling satu detik. Refetch terkontrol saat reconnect/filter berubah.
- Pagination conversation dan messages memakai cursor/keyset, bukan offset untuk riwayat besar.
- Sync tidak dijalankan saat setiap page load; gunakan tombol sync, cron incremental, atau job terjadwal.

## 12. Fase implementasi

### Fase 0 — Prasyarat keamanan

1. Jalankan migration WhatsApp yang masih tertunda, termasuk Notification Center.
2. Pastikan production memiliki `KIRIMDEV_WEBHOOK_SECRET`/`KIRIMDEV_WEBHOOK_SECRETS` yang sama dengan subscription.
3. Tegaskan role admin RLS sebelum staff kedua dibuat.

### Fase 1 — Fondasi data

1. Audit skema dan buat migration Inbox + index + RLS.
2. Tambah typed KirimDev inbox client, repository, mapper, validation schema.
3. Perluas webhook untuk persistence Inbox tanpa mengubah routing Bot/Auto Reply.
4. Tambah backfill/sync manual dan observability.

### Fase 2 — UI kerja CS

1. Tambah navigation dan halaman Inbox.
2. Daftar/filter/search conversation, timeline, composer, status, mark read.
3. Status, priority, label, quick reply, dan assignment jika role user siap.
4. Realtime, empty/loading/error state, mobile layout.

### Fase 3 — Hardening

1. Out-of-order status tests, idempotency test, webhook retry/replay test.
2. 24-hour window, retry failed send, and failure audit test.
3. Privacy review payload/log, load/pagination review, rollback runbook.

## 13. Acceptance criteria sebelum rilis

- [ ] Tidak ada API/secret server-only di browser bundle.
- [ ] Webhook valid signature dan duplicate event terbukti aman.
- [ ] `!menu`/Admin Bot dan Auto Reply existing tetap berfungsi.
- [ ] Customer Inbox hanya menampilkan account Admin Utama secara default.
- [ ] Pesan inbound, outbound, dan status provider muncul konsisten tanpa duplikat.
- [ ] Pesan manual dari composer tercatat pada `logs`/`webhook_logs` existing dan tabel Inbox.
- [ ] Free-form send ditolak jelas di luar jendela 24 jam.
- [ ] Tabel Inbox/RLS tidak dapat dibaca/diubah authenticated user tanpa role.
- [ ] Initial sync dapat dihentikan/dijalankan ulang tanpa menggandakan data.
- [ ] TypeScript, lint target, build produksi, dan test webhook dijalankan dengan hasil nyata.

## 14. Risiko dan rollback

| Risiko | Mitigasi | Rollback |
| --- | --- | --- |
| Webhook inbox mengganggu Auto Reply | Persist Inbox dahulu, lalu panggil engine existing; feature flag `WA_INBOX_ENABLED` | Matikan flag, webhook kembali hanya ke alur existing |
| Pesan ganda | unique key provider + `client_request_id` + event receipt | tahan retry, tandai duplicate tanpa kirim ulang |
| Data provider tidak lengkap | mapper defensif dan sync/backfill | simpan metadata minimal, backfill ulang |
| Status out of order | state machine monotonik | pertahankan status tertinggi dan audit event |
| Akses staff berlebih | RLS role-based dan API authorization | cabut role, nonaktifkan user, audit log |

## 15. Referensi resmi

- KirimDev menerima pesan dan bentuk payload Meta: <https://docs.kirimdev.com/sending/receive-messages/>
- Event `message.sent`, status delivery, conversation/contact events: <https://docs.kirimdev.com/webhooks/events/>
- HMAC signature dan secret rotation: <https://docs.kirimdev.com/webhooks/signing/>
- Konteks platform/multi-tenant (tidak digunakan pada MVP ILJ-Hub): <https://docs.kirimdev.com/platform/>
