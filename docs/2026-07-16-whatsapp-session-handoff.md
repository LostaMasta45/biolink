# Handoff WhatsApp ILJ-Hub — 16 Juli 2026

Dokumen ini adalah catatan kerja lengkap untuk melanjutkan pekerjaan WhatsApp ILJ-Hub pada sesi berikutnya. Jangan memasukkan atau menyalin nilai API key, service-role key, nomor telepon, atau webhook secret ke dokumen/commit.

## Status singkat

- Branch/worktree saat dicatat: commit terakhir `cbdb251 v3`.
- Perubahan belum committed saat dokumen dibuat: `docs/19-prd-whatsapp-inbox-kirimdev.md` dan dokumen handoff ini.
- TypeScript, lint target, dan `npm run build` terakhir **lulus** setelah perubahan webhook HMAC.
- Notification Center dan Command Manager **belum dapat dipakai penuh di database live** karena tiga tabel migration belum ada.
- Hasil cek live terakhir: `notification_rules=404`, `notification_jobs=404`, `bot_commands=404`.

## Keputusan produk yang sudah disepakati

1. Customer selalu mengawali chat ke nomor **Admin Utama**.
2. Customer-facing message dikirim dari **Admin Utama**, memakai free-form/Pesan Tersimpan; proyek tidak memakai Meta template sebagai fallback otomatis 24 jam.
3. Nomor **Bot** hanya untuk Admin Utama menjalankan command internal (`!menu`, `!rekap`, `!buat_invoice`, dan lain-lain).
4. Customer yang mengirim ke Bot diabaikan untuk customer service; command Admin Utama yang dikirim ke nomor selain Bot diabaikan dan dicatat.
5. Tes yang aman dilakukan Bot → Admin Utama, bukan kirim template ke nomor sendiri.
6. Notification Center menjadi pusat konfigurasi copywriting/notifikasi payment, invoice dashboard, poster, reminder, serta retry/delay/dedupe.
7. Flow Builder saat ini hanya visualisasi. Jangan membuat drag-and-drop sebelum ia benar-benar menjadi execution engine. Rekomendasi produk: ubah mental modelnya menjadi Customer Journey/Peta Alur CS lebih dahulu.
8. Rencana berikutnya adalah WhatsApp Inbox customer-facing pada Admin Utama; detailnya ada di `docs/19-prd-whatsapp-inbox-kirimdev.md`.

## Perubahan fitur yang sudah ada di kode

### Notification Center dan notifikasi sistem

- File migration: `supabase-migration-whatsapp-notification-center.sql`.
- Tabel yang dibuat migration: `notification_rules`, `notification_jobs`, `bot_commands`.
- Event yang didukung:
  - `payment.paid.customer`
  - `payment.paid.admin`
  - `invoice.created.admin`
  - `poster.received.customer`
  - `invoice.created.customer`
  - `invoice.reminder.customer`
- Service pusat: `src/services/whatsapp-notification-service.ts`.
- Payment webhook, upload poster, invoice dashboard, dan `!tagih` telah diarahkan untuk memakai event Notification Center.
- Customer menggunakan sender Admin Utama; notifikasi internal memakai Bot → Admin Utama.
- Queue mendukung delay, dedupe, retry, job status, dan audit.
- Cron `src/app/api/cron/whatsapp-auto-reply/route.ts` memproses auto-reply dan Notification Center.
- Endpoint action admin `src/app/api/admin/whatsapp/route.ts` memiliki `process_notification_queue` dan `test_notification_rule`.
- Tombol Play Notification Center menjalankan tes nyata hanya dari Bot ke Admin Utama.

### Command Admin Bot

- Handler utama: `src/lib/whatsapp/command-processor.ts`.
- `!menu`/`!help` mengirim interactive list; jika provider menolak list, Bot mengirim fallback daftar teks.
- Command yang ditargetkan migration: `!menu`/`!help`, `!rekap`/`!rekapan`, `!cek`, `!tagihan`, `!tagih`, `!buat_invoice`/`!invoice`, `!klien`, `!template`, `!notif`, `!gagal`, serta handler internal `!cancel`, `!inv_lowongan`, `!inv_umum`.
- `!template` membaca tabel `templates` (Pesan Tersimpan) dan mengirim melalui Admin Utama.
- Command yang diterima, selesai, dilewati, atau gagal ditulis sebagai:
  - `admin_bot.command.received`
  - `admin_bot.command.completed`
  - `admin_bot.command.skipped`
  - `admin_bot.command.failed`
- Setiap API send sudah dicatat sebagai `api.message.send`; status provider dicatat saat webhook `message.status` tiba.

### Perlindungan `!buat_invoice`

- Alur form/state-machine `!buat_invoice` **dipertahankan**:
  - membuat invoice;
  - Bot mengembalikan teks invoice ke Admin Utama;
  - Admin Utama forward sendiri ke customer.
- Jangan mengubah `!buat_invoice` menjadi pengiriman otomatis Notification Center tanpa persetujuan baru.
- Catatan ini sudah diperbaiki di `docs/18-notification-center-dan-admin-bot.md`.

### Webhook, logging, dan security

- Webhook aktif: `src/app/api/webhook/whatsapp/route.ts`.
- Webhook sekarang memverifikasi `X-Kirim-Signature` dengan HMAC-SHA256 atas `timestamp.raw_body`, maksimum umur 5 menit, dan constant-time comparison.
- Environment yang digunakan: `KIRIMDEV_WEBHOOK_SECRETS` (multi-secret rotasi) atau fallback `KIRIMDEV_WEBHOOK_SECRET` existing.
- Payload invalid dicatat sebagai `webhook.invalid_signature` dan dibalas 401 sebelum command/automation diproses.
- Webhook melakukan event dedupe memakai receipt existing dan mencatat incoming/outgoing event pada `webhook_logs`.
- Parser mendukung text, interactive button/list reply, dan template button; parser legacy juga diperluas defensif.
- `KirimDevSendResult` sekarang membaca provider ID/status dari respons normal `data.id` dan `data.status`, bukan hanya bentuk respons lama. Ini membuat audit dapat menautkan pesan ke provider ID.
- Jangan menghapus HMAC verification; dokumentasi KirimDev mewajibkan payload signed.

### Error Notification Center yang diperbaiki

- Error UI `Unexpected token '<' ... is not valid JSON` berasal dari frontend yang mencoba parse halaman HTML sebagai JSON.
- File `src/services/whatsapp-manager-client.ts` kini membaca body aman dan memberi error eksplisit jika endpoint mengembalikan HTML/route belum ter-deploy.
- Endpoint lokal `POST /api/admin/whatsapp` diverifikasi memberi `401` JSON jika tanpa sesi, jadi route sendiri bukan respons HTML.
- Jika error tampak lagi di production setelah deploy, hard refresh/PWA reload; error baru akan menyebut endpoint/status, bukan JSON parser mentah.

## Hasil tes nyata yang sudah dilakukan

Semua tes menggunakan pasangan aman Bot → Admin Utama dan tidak membuat invoice/customer message.

| Tes | Hasil |
| --- | --- |
| `POST /api/admin/whatsapp` tanpa login | `401` dengan JSON `{ error: "Unauthorized" }` |
| Notification Center route lokal | route tersedia; masalah HTML adalah build/deployment lama, bukan route source |
| `!menu` dengan Phone ID salah | ditolak sebagai `admin_command.wrong_account` (proteksi benar) |
| `!menu` dengan Phone ID Bot dari Settings | `200`, `handled: true`, interactive list diterima KirimDev |
| Klik list reply `!rekap` | `200`, `handled: true` |
| Audit `!menu` | ada command received/completed, API text processing, API interactive list, HTTP 200, provider ID, provider status pending |
| Signature webhook HMAC valid | `200`, `delivery_status_recorded` |
| TypeScript | `npx tsc --noEmit` lulus |
| Lint target | lulus untuk client KirimDev, command processor, webhook, audit service |
| Build produksi | `npm run build` lulus; 45 route/page terbentuk |

Catatan: pesan dengan status `pending/accepted` baru menjadi `sent/delivered/read/failed` ketika subscription KirimDev mengirim `message.status` ke webhook. Pastikan subscription memuat minimal `message.received` dan `message.status`; untuk Inbox kelak tambahkan `message.sent`, `conversation.*`, dan `contact.*` sesuai PRD.

## Database dan deployment — langkah wajib berikutnya

1. Buka Supabase SQL Editor proyek yang benar.
2. Jalankan seluruh isi `supabase-migration-whatsapp-notification-center.sql`.
3. Verifikasi tabel `notification_rules`, `notification_jobs`, dan `bot_commands` dapat dibaca (tidak 404).
4. Pastikan seed rule/template dan command muncul di dashboard.
5. Deploy code terbaru.
6. Pastikan environment deployment memiliki nilai server-only yang sudah ada secara lokal:
   - `KIRIMDEV_API_KEY`
   - Phone ID/nomor Admin Utama dan Bot
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `KIRIMDEV_WEBHOOK_SECRET` atau `KIRIMDEV_WEBHOOK_SECRETS`
   - `CRON_SECRET` bila cron memerlukannya
7. Setelah deploy, hard refresh dashboard atau restart PWA agar JavaScript lama tidak dipakai.
8. Tes Play `invoice.created.admin` lagi; hasil harus Bot → Admin Utama dan tercatat pada Activity/API Log.

### Catatan RLS Supabase

- Service-role dipakai pada kode server, tidak boleh dipindahkan ke client.
- Saat dicek, hanya terdapat satu akun auth. Operasional saat ini terbatas pada akun itu.
- Migration WhatsApp existing masih memiliki policy `Authenticated admin access` dengan `USING (TRUE)` di beberapa tabel. Jangan menambah staff/auth user kedua sebelum policy diganti ke role/allowlist admin yang eksplisit.
- PRD Inbox mewajibkan RLS role-based; jangan membuat tabel Inbox dengan policy authenticated umum.

## Dokumen penting

- `docs/18-notification-center-dan-admin-bot.md` — tutorial operasional, command, log, tes, risiko free-form 24h, dan troubleshooting.
- `docs/19-prd-whatsapp-inbox-kirimdev.md` — PRD Inbox yang sudah disesuaikan untuk ILJ-Hub.
- `PROMPT_CODEX_WHATSAPP_INBOX_KIRIMDEV.md` — prompt generic sumber; jangan diikuti mentah-mentah karena multi-tenant/endpoint-nya harus disesuaikan.
- `supabase-migration-whatsapp-notification-center.sql` — migration yang masih wajib dijalankan.

## PRD Inbox — ringkasan untuk sesi berikutnya

- 10.000 conversation historis dapat disinkronkan **jika** riwayat tersedia di KirimDev; API tidak dapat menarik chat yang hanya tersimpan lokal di aplikasi WhatsApp HP.
- Sinkronkan inventory conversation dahulu, aktifkan webhook live tail, lalu tarik message per conversation saat dibuka.
- Full history adalah worker background resumable dengan cursor/checkpoint/backoff/dedupe, bukan request tunggal atau page-load.
- Inbox MVP hanya menampilkan customer conversation pada Admin Utama; Bot tetap internal.
- Jangan mulai implementasi Inbox sebelum migration Notification Center selesai dan keputusan role/RLS untuk staff sudah jelas.

## Hal yang tidak boleh dilupakan atau diubah diam-diam

- Jangan mengubah `!buat_invoice` menjadi auto-send ke customer.
- Jangan mengirim test template ke nomor sendiri; pakai Bot → Admin Utama.
- Jangan menonaktifkan HMAC webhook demi memudahkan tes. Buat signature tes yang valid.
- Jangan memanggil KirimDev dari Client Component atau mengekspos key/secret.
- Jangan membuat Flow Builder drag-and-drop semata sebagai tampilan; execution engine harus nyata bila nanti diprioritaskan.
- Jangan menghapus log API/webhook/command. Mereka dipakai untuk diagnosis pengiriman dan delivery status.

## Mulai sesi berikutnya dari sini

1. Tanyakan/cek apakah migration Notification Center sudah dijalankan.
2. Jika sudah, cek tiga tabel, seed rule, seed command, dan lakukan tes Play Notification Center.
3. Jika deploy sudah dilakukan, tes `!menu` dan `!rekap` dari Admin Utama ke Bot dengan webhook signature provider asli.
4. Bila stabil, pilih prioritas berikutnya: hardening RLS admin atau implementasi Fase 0/1 WhatsApp Inbox berdasarkan `docs/19-prd-whatsapp-inbox-kirimdev.md`.
