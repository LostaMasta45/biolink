# Flow Builder

Flow Builder adalah canvas customer journey WhatsApp yang dapat dieksekusi. Bukan sekadar gambar: setiap trigger membuat `flow_run`, setiap node membuat `flow_run_step`, dan semua perubahan status masuk ke Activity & API Logs.

## Aktivasi

1. Jalankan `supabase-migration-flow-execution.sql` di Supabase SQL Editor.
2. Deploy aplikasi.
3. Pada dashboard KirimDev, pastikan subscription webhook mencakup `message.received`, `message.status`, `conversation.assigned`, `conversation.closed`, `contact.created`, dan `contact.updated`.
4. Buat atau pilih **Auto Reply** terlebih dahulu bila flow dimulai oleh keyword. Atur keyword, pencocokan, cooldown, jadwal, test mode, dan handover hanya di sana.
5. Buat Flow Map, atur node pada canvas, lalu klik **Hubungkan Auto Reply** untuk memilih rule yang menjadi pintu masuk.
6. Gunakan **Trigger event** hanya untuk event non-keyword atau untuk flow lanjutan yang benar-benar berlaku bagi semua pesan.
7. Klik **Validasi** sebelum mengaktifkan trigger.

## Canvas

- Tarik node untuk mengubah posisi. Posisi tersimpan.
- Tarik konektor dari sisi node ke node lain untuk menyimpan `Next Step`.
- Node hijau adalah trigger Auto Reply (keyword); node biru muda adalah trigger event; node biru tua adalah langkah flow.
- Klik node untuk memilih Pesan Tersimpan, mode eksekusi, delay, dan Next Step. Klik trigger untuk mengganti sambungan atau menghapusnya.
- Menghapus node akan mengalihkan setiap node yang sebelumnya mengarah kepadanya ke `Next Step` node yang dihapus. Bila tidak ada `Next Step`, journey selesai. Ini mencegah koneksi flow putus diam-diam.

Mode node:

| Mode | Perilaku |
| --- | --- |
| Kirim & tunggu balasan | Kirim pesan lalu customer membalas untuk melanjutkan Next Step. |
| Kirim & lanjut otomatis | Kirim pesan lalu langsung menjalankan Next Step. Sistem membatasi 25 transisi agar loop tidak berjalan tanpa henti. |
| Tunggu balasan | Tidak mengirim pesan, hanya menunggu balasan customer. |
| Selesaikan flow | Menutup run sebagai `completed`. |

Delay maksimal 5 detik dieksekusi dalam request yang sama. Delay lebih besar ditolak oleh validasi sampai scheduler per-menit tersedia; ini mencegah job tampak pending tetapi tidak pernah berjalan.

## Auto Reply vs Flow trigger

**Auto Reply adalah sumber tunggal aturan pesan masuk.** Ia menjawab pertanyaan “pesan customer apa yang memulai automation?”: keyword, tipe pencocokan, prioritas, delay, cooldown, jadwal, test mode, dan handover. Bila rule tersebut dihubungkan ke Flow Map, keyword yang sama memulai node pertama flow. Bila dilepas, Auto Reply kembali menggunakan template fallback-nya. Melepas trigger dari Flow Builder tidak menghapus rule Auto Reply.

Flow Builder menangani pertanyaan berikutnya: “setelah rule cocok, journey apa yang dijalankan?” Karena itu form trigger pesan masuk menawarkan dropdown Auto Reply, bukan form keyword kedua. Ini menghindari keyword yang sama memiliki dua konfigurasi berbeda.

Opsi **Semua pesan masuk** tetap ada sebagai trigger lanjutan. Pilih hanya bila seluruh pesan customer harus menjalankan flow umum; jangan gunakan untuk flow keyword karena dapat bertabrakan dengan Auto Reply.

## Trigger event yang tersedia

| Trigger UI | Sumber | Konfigurasi |
| --- | --- | --- |
| Saat pesan masuk | `message.received` Meta melalui KirimDev | Pilih rule Auto Reply yang sudah ada (disarankan), atau trigger lanjutan untuk semua pesan. |
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
