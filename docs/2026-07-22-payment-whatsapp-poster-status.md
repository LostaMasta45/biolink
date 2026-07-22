# Status Payment, WhatsApp, dan Upload Poster

Tanggal pembaruan: 22 Juli 2026

## Ringkasan

Alur pembayaran QRIS, invoice, antrean posting, upload poster, dan notifikasi WhatsApp sudah diperbaiki dan telah dirilis ke production (`infolokerjombang.net`).

Order pengujian `ILJ-260721-A9B3EAA703` telah direkonsiliasi ulang sebagai bukti alur end-to-end:

- Status pembayaran `PAID`.
- Invoice dan transaksi keuangan tercatat.
- Antrean posting berhasil dibuat.
- Notifikasi invoice dan pembayaran ke customer/admin telah mendapatkan status provider `delivered`.

## Yang sudah selesai

### Pembayaran dan antrean posting

- Invoice dibuat saat QRIS berhasil dibuat, lalu notifikasi invoice dipicu.
- Pembayaran yang dikonfirmasi lewat webhook maupun polling status menjalankan sinkronisasi yang sama dan aman dipanggil berulang (idempoten).
- Kegagalan sinkronisasi antrean tidak lagi menghentikan notifikasi pembayaran.
- `scheduled_time` antrean memakai format database `10:00:00`, bukan label `pagi`.
- Paket uji coba QRIS ID `99` telah ditambahkan sebagai paket internal/nonaktif agar foreign key antrean valid tanpa tampil sebagai layanan jual.
- Mapping add-on katalog pembayaran ke add-on antrean posting telah diselaraskan.

### Upload poster

- Upload dari halaman payment sekarang melewati endpoint server `/api/payment/upload-poster-file`.
- Endpoint memverifikasi `order_id`, `upload_token`, status `PAID`, jenis file gambar, dan batas ukuran 10 MB.
- File kemudian diunggah dengan service role ke bucket `posters`, sehingga tidak bergantung pada policy Storage di browser customer.
- Endpoint `/api/payment/upload-poster` menautkan URL poster ke `posting_queue` (`poster_url`, `poster_urls`, caption, status `queued`).
- Jika customer membuka upload sebelum antrean sempat terbentuk, sistem merekonsiliasi order `PAID` terlebih dahulu sebelum menolak upload.

### Notifikasi WhatsApp

Rule aktif yang relevan:

| Event | Rute pengiriman | Fungsi |
| --- | --- | --- |
| `invoice.created.customer` | Admin Utama ke customer | Invoice/link pembayaran |
| `invoice.created.admin` | Bot ke Admin Utama | Laporan invoice baru |
| `payment.paid.customer` | Admin Utama ke customer/custom | Konfirmasi pembayaran |
| `payment.paid.admin` | Bot ke Admin Utama | Laporan pembayaran berhasil |
| `poster.received.customer` | Admin Utama ke nomor pada form payment | Poster diterima dan masuk antrean |
| `poster.received.admin` | Bot ke Admin Utama | Laporan poster masuk antrean |

- Copywriting poster customer dan laporan poster admin sudah dibuat sebagai Pesan Tersimpan dan dapat diubah dari Notification Center.
- Delivery provider kini ditautkan dengan ID WhatsApp (`wamid`), sehingga status `failed`, `sent`, dan `delivered` tercatat pada job yang tepat.
- Worker antrean pada webhook sekarang ditunggu hingga batch kecil selesai; tidak lagi hanya dijalankan di proses latar yang dapat diputus Vercel.
- Laporan untuk **setiap chat customer** telah dinonaktifkan dan pemicunya dihapus dari kode untuk mencegah spam.

### Aturan jendela WhatsApp 24 jam

- Patokan adalah waktu inbound terakhir dari customer ditambah **tepat 24 jam** (bukan 23 jam, pembulatan jam, atau durasi yang dikurangi).
- Timestamp webhook dan riwayat provider dinormalisasi, termasuk timestamp Unix dalam detik/milidetik. Pesan gambar, dokumen, tombol, maupun teks semuanya memperbarui jendela karena semuanya adalah inbound WhatsApp yang sah.
- Sinkronisasi riwayat yang datang tidak berurutan tidak boleh lagi menimpa inbound terbaru atau memendekkan batas 24 jam di Inbox.
- Inbox menghitung status dari `last_inbound_at` secara langsung dan menampilkan batas waktu serta sisa waktu yang jelas. Kolom cache `service_window_expires_at` juga diselaraskan ulang saat sync.
- Saat jendela belum ada, timestamp tidak valid, atau sudah habis, pesan free-form tidak diteruskan ke provider. Ini berlaku untuk customer, nomor custom, Bot → Admin Utama, maupun Admin Utama → Bot. Log akan menyimpan `inbox.message.blocked_24h` atau `notification.blocked_24h` beserta alasan dan waktu berakhirnya. Flow Map juga menyimpan alasan yang sama pada error langkah flow.
- Setelah 24 jam benar-benar habis, customer perlu mengirim chat baru untuk membuka ulang jendela. Alternatif untuk pengiriman proaktif adalah template WhatsApp resmi yang disetujui Meta/KirimDev.

## Konfigurasi production yang perlu diperhatikan

1. Rule `payment.paid.customer` saat pemeriksaan terakhir masih menggunakan penerima **custom** `62895623834500`. Ini cocok untuk tes, tetapi bila pembayaran harus dikirim ke setiap pembeli, ubah penerimanya di Notification Center menjadi **Customer dari event**.
2. Pesan teks WhatsApp hanya dapat dikirim dalam jendela layanan Meta 24 jam sejak penerima terakhir menghubungi nomor pengirim. Untuk pengiriman yang harus tetap berjalan di luar jendela ini, siapkan dan gunakan template WhatsApp resmi yang sudah disetujui Meta/KirimDev.
3. Akun Vercel saat ini bertipe Hobby; cron hanya dapat berjalan harian. Pengiriman normal dijalankan langsung saat event terjadi, sedangkan retry tanpa event baru paling lambat diproses oleh cron harian. Jika diperlukan SLA retry menit/jam, gunakan Vercel Pro atau scheduler eksternal.

## File/migration yang perlu disimpan

- `supabase-migration-payment-test-package.sql`: paket internal ID 99 untuk test QRIS.
- `supabase-migration-poster-customer-notifications.sql`: seed template dan rule notifikasi poster.

Data yang setara sudah diterapkan di database production. Jalankan kedua migration tersebut juga pada environment baru/staging.

## Checklist operasional singkat

1. Customer membuat order dan QRIS.
2. Pastikan invoice customer/admin dan laporan pembayaran admin muncul sesuai rule.
3. Customer upload poster dari langkah Upload Poster.
4. Pastikan dashboard **Admin / Antrean** menampilkan order dengan status `queued` dan URL poster.
5. Pastikan notifikasi poster customer serta laporan Bot ke Admin Utama memiliki status `delivered` di Logs/Notification Center.
