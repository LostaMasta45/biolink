# WhatsApp Inbox dan Balas Cepat

## Aktivasi

1. Jalankan `supabase-migration-whatsapp-inbox.sql` pada Supabase SQL Editor setelah migration WhatsApp sebelumnya.
2. Deploy aplikasi.
3. Pastikan subscription KirimDev tetap mencakup `message.received`, `message.sent`, dan `message.status`.
4. Buka **WhatsApp → Inbox**. Pilih akun **Admin Utama** atau **Bot**. Pesan customer baru yang masuk ke Admin Utama akan membuat contact, conversation, dan message lokal sebelum Auto Reply/Flow diproses; percakapan Admin → Bot masuk ke Inbox Bot terpisah.

## Batasan nomor

- Admin Utama dan Bot dipilih sebagai scope terpisah di Inbox, sehingga histori tidak tercampur.
- Customer yang menulis ke Bot tidak diperlakukan sebagai chat customer. Percakapan internal Admin → Bot dapat dilihat di scope Bot.
- Inbox adalah read model Supabase. API key, service role, dan webhook secret tidak pernah dikirim ke browser.

## Mengirim pesan

- Composer mengirim teks dari nomor Admin Utama melalui KirimDev.
- Pesan dibuat lokal sebagai `pending`, lalu berubah `sent`, `delivered`, `read`, atau `failed` berdasarkan respons, webhook `message.sent`, dan `message.status`.
- Klik ganda aman karena setiap pengiriman membawa `client_request_id` UUID.
- Pengiriman teks manual ditolak jelas bila jendela layanan WhatsApp 24 jam telah berakhir.
- Semua pengiriman tetap ditulis ke Activity/API Logs; message Inbox menyimpan sumber `manual_inbox` atau `quick_reply`.

## Balas Cepat

Balas Cepat bukan Auto Reply dan bukan trigger Flow.

1. Di Inbox, buka **Balas Cepat**.
2. Pilih satu **Pesan Tersimpan** bertipe teks dan isi shortcut, misalnya `chat`.
3. Pada composer ketik `/chat`, lalu pilih hasilnya.
4. Isi Pesan Tersimpan dimasukkan ke draft. Admin boleh mengeditnya sebelum klik **Kirim**.

Shortcut hanya aktif/nonaktif untuk tampilan composer. Menonaktifkan `/chat` tidak mengubah Keyword Automation, Flow Map, template, atau webhook.

## Sinkronisasi lengkap yang resumable

- Tombol **Sync semua** melakukan tiga tahap otomatis untuk akun yang dipilih: inventory `GET /v1/{phone_number_id}/conversations`, kontak `GET /v1/{phone_number_id}/contacts`, lalu riwayat `GET /v1/{phone_number_id}/messages`.
- Setiap request memakai halaman hingga 100 data dan cursor opaque KirimDev. Cursor/checkpoint berada di `wa_inbox_sync_state`, jadi refresh halaman atau kegagalan jaringan tidak mengulang batch yang sudah berhasil.
- Daftar percakapan disinkronkan lebih dahulu agar UI langsung terasa cepat. Riwayat pesan besar dilanjutkan bertahap sambil progres batch ditampilkan.
- Tombol **Sync semua kontak** pada menu Kontak memakai alur cursor otomatis yang sama.
- Pesan dari endpoint list KirimDev memakai field `content` sebagai teks; mapper Inbox menyimpannya menjadi body bubble agar tidak lagi kosong.

## Backfill otomatis

- Karena project memakai Vercel Hobby (cron native hanya harian), GitHub Actions menjalankan worker `GET /api/cron/whatsapp-inbox-sync` setiap 5 menit. Ini adalah interval minimum GitHub Actions. Route memverifikasi token OIDC singkat dari repository ini; tidak ada secret scheduler yang disimpan di repository.
- Satu tick mengambil batch kecil dan menyimpan cursor. Prioritasnya: daftar percakapan, kontak, lalu riwayat pesan. Dengan pola ini 10.000 chat dan 6.000 kontak dapat diselesaikan tanpa request raksasa atau timeout.
- Saat initial backfill selesai, webhook KirimDev tetap menjadi jalur utama untuk pesan baru dan perubahan status; worker tidak mengunduh ulang seluruh riwayat setiap menit.
- Cek `webhook_logs` dengan event `inbox.backfill.worker` untuk jumlah data per tick, error provider, dan status penyelesaian.

## Status dan pemulihan

- Bila pesan inbound belum muncul, periksa menu Webhook serta `webhook_logs` untuk event `message.received`.
- Bila pengiriman manual gagal, bubble pesan menampilkan alasan provider dan Activity/API Logs menyimpan detail respons.
- Status provider yang terlambat tidak boleh menurunkan `read` menjadi `delivered` atau `sent`.
- Untuk perubahan Inbox yang baru terlihat saat halaman sedang terbuka, UI menyegarkan daftar dan percakapan aktif setiap 5 detik; klik **Muat ulang** tersedia untuk refresh langsung.
