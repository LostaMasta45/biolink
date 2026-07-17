# WhatsApp Inbox dan Balas Cepat

## Aktivasi

1. Jalankan `supabase-migration-whatsapp-inbox.sql` pada Supabase SQL Editor setelah migration WhatsApp sebelumnya.
2. Deploy aplikasi.
3. Pastikan subscription KirimDev tetap mencakup `message.received`, `message.sent`, dan `message.status`.
4. Buka **WhatsApp → Inbox**. Pesan customer baru yang masuk ke nomor Admin Utama akan membuat contact, conversation, dan message lokal sebelum Auto Reply/Flow diproses.

## Batasan nomor

- Inbox hanya menyimpan percakapan customer ke **Admin Utama**.
- Nomor Bot dan command internal Admin → Bot tidak masuk Inbox customer.
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

## Status dan pemulihan

- Bila pesan inbound belum muncul, periksa menu Webhook serta `webhook_logs` untuk event `message.received`.
- Bila pengiriman manual gagal, bubble pesan menampilkan alasan provider dan Activity/API Logs menyimpan detail respons.
- Status provider yang terlambat tidak boleh menurunkan `read` menjadi `delivered` atau `sent`.
- Untuk perubahan Inbox yang baru terlihat saat halaman sedang terbuka, UI menyegarkan daftar dan percakapan aktif setiap 5 detik; klik **Muat ulang** tersedia untuk refresh langsung.
