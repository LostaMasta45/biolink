# Flow Builder

Flow Builder adalah canvas customer journey WhatsApp yang dapat dieksekusi. Bukan sekadar gambar: setiap trigger membuat `flow_run`, setiap node membuat `flow_run_step`, dan semua perubahan status masuk ke Activity & API Logs.

## Aktivasi

1. Jalankan `supabase-migration-flow-execution.sql` di Supabase SQL Editor.
2. Deploy aplikasi.
3. Pada dashboard KirimDev, pastikan subscription webhook mencakup `message.received`, `message.status`, `conversation.assigned`, `conversation.closed`, `contact.created`, dan `contact.updated`.
4. Buat Flow Map, atur node pada canvas, kemudian tambah trigger.
5. Klik **Validasi** sebelum mengaktifkan trigger.

## Canvas

- Tarik node untuk mengubah posisi. Posisi tersimpan.
- Tarik konektor dari sisi node ke node lain untuk menyimpan `Next Step`.
- Node hijau adalah trigger; node biru adalah langkah flow.
- Klik node untuk memilih Pesan Tersimpan, mode eksekusi, delay, dan Next Step.

Mode node:

| Mode | Perilaku |
| --- | --- |
| Kirim & tunggu balasan | Kirim pesan lalu customer membalas untuk melanjutkan Next Step. |
| Kirim & lanjut otomatis | Kirim pesan lalu langsung menjalankan Next Step. Sistem membatasi 25 transisi agar loop tidak berjalan tanpa henti. |
| Tunggu balasan | Tidak mengirim pesan, hanya menunggu balasan customer. |
| Selesaikan flow | Menutup run sebagai `completed`. |

Delay maksimal 5 detik dieksekusi dalam request yang sama. Delay lebih besar ditolak oleh validasi sampai scheduler per-menit tersedia; ini mencegah job tampak pending tetapi tidak pernah berjalan.

## Trigger yang tersedia

| Trigger UI | Sumber | Konfigurasi |
| --- | --- | --- |
| Saat pesan masuk | `message.received` Meta melalui KirimDev | Semua pesan, sama persis, diawali, atau mengandung keyword. |
| Saat chat baru dimulai | `contact.created` KirimDev | Tidak ada parameter. |
| Saat chat diselesaikan | `conversation.closed` KirimDev | Tidak ada parameter. |
| Saat chat di-assign | `conversation.assigned` KirimDev | Tidak ada parameter. |
| Saat label ditambahkan | `contact.updated` KirimDev | Nama label. Sistem mencocokkan labels pada payload. |
| Saat jendela 24 jam hampir habis | Scheduler lokal | Menit sebelum jendela berakhir. |
| Saat chat tidak aktif | Scheduler lokal | Durasi tidak aktif dalam menit. |

KirimDev mengirim event inbox native dengan envelope berbeda dari event Meta. Engine membedakan keduanya dari header `X-Kirim-Event`, menyimpan event receipt untuk deduplikasi, dan hanya menjalankan trigger bila flow dan trigger sama-sama aktif.

## Aturan WhatsApp 24 jam

Pesan Tersimpan pada ILJ Hub adalah pesan free-form, bukan Meta approved template. Karena itu Flow Map memeriksa `last_inbound_at` customer sebelum node mengirim. Bila sudah melewati 24 jam, run menjadi `failed` dengan alasan `outside_24h_window`; sistem tidak akan mencoba mengirim diam-diam.

Trigger `window_expiring` sengaja berjalan sebelum batas 24 jam. Trigger `chat_inactive` dapat menemukan customer yang sudah berada di luar jendela, tetapi node kirim akan gagal secara eksplisit sampai flow memakai jalur template Meta approved yang terpisah.

## Status dan audit

- `pending_delivery`: KirimDev sudah menerima request, menunggu callback provider.
- `delivered` / `read`: Meta mengonfirmasi pesan diterima atau dibaca.
- `failed`: provider menolak, jendela 24 jam berakhir, node/template tidak tersedia, atau flow loop terdeteksi.
- `completed`: node akhir telah menyelesaikan journey.

`provider_message_id`, `flow_run_id`, `step_id`, `trigger_id`, dan alasan error tersimpan pada metadata log. Riwayat terakhir juga tersedia di bawah canvas.

## Referensi implementasi

- [KirimDev Event Catalogue](https://docs.kirimdev.com/webhooks/events/) — daftar event Meta dan KirimDev native, status delivery, serta subscription.
- [KirimDev Receive Messages](https://docs.kirimdev.com/sending/receive-messages/) — bentuk payload Meta, interactive reply, HMAC, retry, dan deduplikasi.
- [KirimDev 24-hour window & templates](https://docs.kirimdev.com/guides/24h-window-and-templates/) — batas pengiriman free-form dan penggunaan template di luar jendela.
