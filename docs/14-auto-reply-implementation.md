# Implementasi Auto Reply WhatsApp

## Alur final

1. KirimDev mengirim event `message.received` ke `/api/webhook/whatsapp`.
2. Endpoint hanya memproses event tersebut; `message.sent` dan status diabaikan agar tidak terjadi loop.
3. Teks customer dinormalisasi (huruf kecil, Unicode NFKC, spasi dirapikan) dan dicocokkan persis dengan satu keyword aktif.
4. Rule mengambil copywriting dari tabel `templates`.
5. Nomor Admin Utama mengirim balasan melalui `POST /v1/{phone_number_id}/messages`.
6. Error baca rule atau error KirimDev menghasilkan HTTP 500 agar delivery webhook dapat dicoba ulang.

## Penyebab kegagalan sebelumnya

- Webhook memakai anon key karena `SUPABASE_SERVICE_ROLE_KEY` tidak tersedia, sedangkan RLS tidak memberi akses baca ke `auto_reply`.
- Form mengirim `match_type`, tetapi migration utama tidak membuat kolom tersebut.
- Error database ditelan dan endpoint tetap mengembalikan sukses, sehingga webhook tampak sehat meskipun tidak ada rule yang dijalankan.
- Event outbound tidak dibedakan tegas dari pesan customer dan berisiko diproses kembali.

## Form yang dipertahankan

- Keyword
- Template copywriting
- Status aktif

Automation generik tidak lagi menjadi execution path untuk pesan masuk. Route lama `/admin/whatsapp/automation` diarahkan ke halaman Auto Reply.

## Deployment database

Jalankan `supabase-migration-auto-reply-webhook.sql` satu kali di SQL Editor Supabase. Policy tersebut hanya membuka SELECT untuk rule dan template aktif; perubahan data tetap membutuhkan sesi admin.

Untuk activity log dan webhook log yang lengkap, tambahkan `SUPABASE_SERVICE_ROLE_KEY` sebagai environment variable server-only. Jangan memakai prefix `NEXT_PUBLIC_` untuk key tersebut.
