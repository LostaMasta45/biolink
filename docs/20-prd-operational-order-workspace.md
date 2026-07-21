# PRD — Operational Order Workspace & WhatsApp Admin Bot

Status: usulan produk  
Tanggal: 17 Juli 2026  
Pemilik: INFOLOKERJOMBANG

## 1. Keputusan produk

Inbox WhatsApp **bukan CRM percakapan jangka panjang**. Fungsinya dibatasi sebagai ruang kerja untuk customer yang sedang memasang lowongan: menerima konteks pemasangan, memantau kelengkapan, dan mengirim pembaruan transaksi.

Produk yang perlu dibangun berikutnya adalah **Operational Order Workspace**: satu alur operasional untuk mengubah permintaan pemasangan menjadi lowongan yang terbit, dengan WhatsApp Admin Bot sebagai remote control admin.

Tujuan utamanya:

1. Mengurangi langkah manual dari chat sampai lowongan terbit.
2. Menghilangkan informasi yang tercecer antara Antrian Posting, Invoice, Pembayaran, poster, Telegram, dan WhatsApp.
3. Membuat admin selalu tahu pekerjaan yang harus dilakukan sekarang.
4. Memindahkan notifikasi operasional utama dari Telegram ke WhatsApp Bot tanpa memutus proses yang sudah berjalan.

## 2. Temuan dari sistem saat ini

### Yang sudah tersedia

- Dashboard Admin membaca posting, paket, dan transaksi; sudah menampilkan omzet, jadwal hari ini, posting terlambat, kalender, serta pelanggan berulang.
- Antrian Posting, Invoice, Pembayaran/QRIS, dan upload poster sudah merupakan bagian sistem terpisah.
- WhatsApp mempunyai Template, Auto Reply, Flow Builder, Notification Center, log/audit, dan Admin Bot.
- Admin Bot WhatsApp sudah mempunyai command `!menu`, `!rekap`, `!cek`, `!tagihan`, `!tagih`, `!buat_invoice`, `!klien`, `!template`, `!notif`, `!gagal`, dan `!cancel`.
- Notification Center sudah menerapkan sender yang benar: Bot → Admin untuk internal dan Admin Utama → customer untuk pesan customer.

### Celah yang paling mahal secara operasional

1. Tidak ada satu objek kerja yang menyatukan permintaan, data perusahaan, paket, poster, invoice, pembayaran, jadwal, dan hasil terbit.
2. Dashboard lebih banyak melaporkan angka historis daripada memberikan daftar tindakan berikutnya.
3. Pembuatan invoice dari bot masih meminta data manual satu per satu dan menghasilkan teks untuk di-forward. Ini cepat untuk kasus sederhana, tetapi tidak mengunci keterkaitan dengan antrian posting.
4. Notifikasi Telegram dipanggil langsung dari beberapa service dan route pembayaran/posting. Ini berisiko menghasilkan format, retry, dan log yang tidak konsisten.
5. Status penting seperti “belum upload poster”, “invoice belum dibayar”, “sudah bayar tetapi belum dijadwalkan”, atau “jadwal hari ini belum diposting” belum menjadi satu antrean prioritas.
6. Data pelanggan berulang hanya menjadi statistik; belum dapat dipakai untuk mempercepat pemasangan ulang.

## 3. Sasaran pengguna

| Pengguna | Kebutuhan utama |
| --- | --- |
| Admin utama | Membuat order, melihat pekerjaan prioritas, menyetujui data, dan mengendalikan proses dari dashboard atau WhatsApp Bot. |
| Admin posting | Mengetahui lowongan yang siap dijadwalkan/diposting beserta asset yang valid. |
| Finance | Mengetahui invoice yang belum bayar, pembayaran diterima, dan order yang siap dilanjutkan. |
| Pemasang lowongan | Mengirim data/pembayaran/poster sekali dan mendapat status yang jelas. |

## 4. Alur target: pemasangan lowongan

```text
Permintaan masuk / order dibuat
  → Brief perusahaan & lowongan
  → Pilih paket dan add-on
  → Invoice dibuat
  → Menunggu pembayaran
  → Pembayaran terverifikasi
  → Menunggu poster/data
  → Siap dijadwalkan
  → Terjadwal
  → Terposting
  → Selesai / follow-up perpanjangan
```

Setiap transisi harus memiliki pemilik, waktu, bukti, dan log. Sistem tidak boleh melompat ke “Siap dijadwalkan” apabila invoice belum berstatus lunas atau data/poster yang diwajibkan belum lengkap.

## 5. Fitur inti: Order Workspace

### 5.1 Objek kerja tunggal: Order Pemasangan

Buat halaman baru **Pemasangan** sebagai sumber kebenaran operasional. Pada fase awal, halaman ini dapat membentuk *projection* dari tabel posting, invoice, payment order, dan data upload yang sudah ada; tidak perlu migrasi berisiko sekaligus.

Data minimal satu order:

- ID order yang mudah dibaca, misalnya `ILJ-20260717-024`.
- Nama perusahaan, PIC, nomor WhatsApp, dan kategori perusahaan.
- Judul lowongan, paket, add-on, harga final, dan admin penanggung jawab.
- Link invoice/order pembayaran serta status pembayaran.
- Daftar asset: poster, logo, deskripsi, link formulir, deadline, dan catatan.
- Tanggal/jam target posting dan status eksekusi.
- Jejak aktivitas dari dibuat hingga terbit.

Status yang disarankan:

| Status | Makna | Aksi utama |
| --- | --- | --- |
| `draft` | Belum siap ditagihkan | Lengkapi brief/paket |
| `awaiting_payment` | Invoice terkirim | Kirim pengingat / cek pembayaran |
| `paid_needs_assets` | Lunas, data belum lengkap | Minta poster atau detail lowongan |
| `ready_to_schedule` | Semua syarat selesai | Tentukan jadwal |
| `scheduled` | Menunggu waktu posting | Pastikan eksekusi |
| `posted` | Sudah terbit | Kirim konfirmasi dan tautan |
| `blocked` | Ada masalah | Tampilkan alasan dan pemilik |
| `cancelled` | Dibatalkan | Catat alasan |

### 5.2 Tampilan daftar yang berbasis tindakan

Halaman Pemasangan tidak berupa tabel besar saja. Header harus menampilkan enam antrean tindakan:

- Perlu dilengkapi hari ini
- Invoice menunggu pembayaran
- Lunas tetapi belum ada poster/data
- Siap dijadwalkan
- Jadwal hari ini
- Terlambat / bermasalah

Klik setiap angka membuka daftar yang sudah terfilter. Setiap baris memuat perusahaan, paket, nominal, usia status, due date, dan satu *next action* yang jelas, misalnya “Minta poster”, “Buat jadwal”, atau “Posting sekarang”.

### 5.3 Detail order sebagai checklist

Detail order memakai sidebar atau drawer, bukan memaksa pindah halaman berulang. Isinya:

1. Ringkasan customer dan paket.
2. Checklist kelengkapan data.
3. Invoice dan pembayaran.
4. Asset/poster dengan preview.
5. Jadwal dan tautan ke Antrian Posting.
6. Timeline audit.
7. Tombol aman: kirim reminder, minta data, tandai siap, jadwalkan, dan tandai terposting.

Pesan yang dikirim dari tombol harus memakai Notification Center agar sender, dedupe, retry, serta status delivery tetap konsisten.

### 5.4 Pemasangan ulang untuk pelanggan berulang

Pada perusahaan yang pernah memasang, tombol **Buat pemasangan ulang** harus mengisi otomatis data perusahaan, PIC, nomor, paket sebelumnya, dan preferensi. Admin hanya memperbarui isi lowongan, jadwal, dan harga bila berbeda.

Ini lebih berguna daripada CRM customer umum karena data hanya dipakai untuk transaksi pemasangan lowongan.

## 6. Perbaikan Dashboard Admin

Dashboard utama perlu berubah dari “laporan cantik” menjadi **command center harian**.

### Atas halaman: kondisi hari ini

Ganti sebagian kartu statistik dengan kartu yang dapat ditindak:

- Order perlu tindakan hari ini.
- Pembayaran pending bernilai total rupiah.
- Order lunas yang belum siap posting.
- Jadwal posting hari ini dan yang terlambat.
- Kegagalan automasi/notifikasi 24 jam terakhir.

Kartu omzet bulanan dan trend tetap dipertahankan, tetapi ditempatkan pada bagian analitik agar tidak menyembunyikan pekerjaan mendesak.

### Bagian kerja cepat

- Tombol `Pemasangan baru`, `Invoice baru`, `Upload poster`, dan `Buka jadwal hari ini`.
- “Lanjutkan pekerjaan terakhir” berdasarkan order yang baru diubah admin.
- Daftar maksimal lima order yang paling perlu tindakan dengan SLA/umur status.
- Pusat error: pembayaran gagal, pengiriman WhatsApp gagal, webhook gagal, dan sinkronisasi tertunda.

### Bagian analitik yang benar-benar berguna

- Funnel: dibuat → invoice → dibayar → siap → terposting.
- Waktu median dari invoice hingga bayar dan dari bayar hingga terposting.
- Paket dan add-on paling laku.
- Revenue per paket, bukan hanya total omzet.
- Pelanggan berulang dan order yang berpotensi perpanjangan.
- Beban jadwal per hari agar admin tidak menumpuk posting pada satu jam.

## 7. WhatsApp: peran baru yang tepat

### 7.1 Customer-facing: singkat dan transaksional

Nomor Admin Utama hanya menangani customer pemasang lowongan. Pesan yang disarankan:

- Konfirmasi request diterima.
- Link form brief atau link order yang aman.
- Invoice dan pengingat pembayaran.
- Permintaan poster/data yang belum ada.
- Konfirmasi jadwal dan link hasil posting.

Jangan membangun percakapan CRM panjang. Setiap pesan customer dapat ditautkan ke Order Pemasangan aktif melalui nomor/order ID, tetapi detail kerja tetap diselesaikan dalam dashboard.

### 7.2 Admin Bot: remote control operasional

Bot tetap hanya menerima pesan dari nomor Admin Utama. Perlu ditambah menu tombol/list agar admin tidak menghafal command:

| Aksi | Hasil |
| --- | --- |
| `Pemasangan baru` | Membuka form bertahap: perusahaan → nomor → paket → harga → invoice. |
| `Pekerjaan hari ini` | Ringkasan dan daftar order prioritas. |
| `Lunas belum lengkap` | Daftar order yang perlu poster/data. |
| `Jadwal hari ini` | Daftar posting dan tombol buka detail order. |
| `Tagih invoice` | Pilih invoice pending; sistem mengirim dari Admin Utama. |
| `Cek order` | Mencari berdasarkan ID, nomor, atau nama perusahaan. |
| `Error terbaru` | Lima kegagalan dengan link dashboard/log. |

Command teks tetap tersedia sebagai shortcut untuk power user: `!buat`, `!hariini`, `!siap`, `!jadwal`, `!tagih`, `!cek`, dan `!gagal`.

### 7.3 Aturan pengiriman

- Customer selalu menerima pesan dari **Admin Utama**.
- Bot hanya mengirim notifikasi internal ke **Admin Utama**.
- Pesan customer di luar jendela layanan harus mengikuti aturan KirimDev/Meta yang berlaku; sistem menampilkan alasan gagal dan tidak boleh mencoba ulang secara buta.
- Semua aksi bot harus idempotent memakai `order_id` atau `invoice_id`, serta membuat audit log.

## 8. Konsolidasi Telegram ke WhatsApp

### Kondisi saat ini

Telegram dipakai sebagai pengiriman notifikasi keluar dari service finance, invoice, posting, payment webhook, dan upload poster. Tidak ditemukan alur command Telegram masuk yang perlu dipertahankan.

### Keputusan

Jadikan **WhatsApp Bot → Admin Utama** kanal notifikasi operasional utama. Telegram dipertahankan sebagai fallback selama masa transisi, bukan sebagai sumber kebenaran atau jalur action.

### Desain channel notifikasi

Semua service hanya memancarkan event domain, misalnya:

- `order.created`
- `invoice.created`
- `payment.paid`
- `assets.missing`
- `posting.scheduled`
- `posting.published`
- `integration.failed`

Notification Center menentukan channel dan template. Konfigurasi rule per event:

- WhatsApp Bot ke Admin: default aktif untuk event operasional.
- Telegram: opsi fallback / ringkasan, default nonaktif setelah transisi.
- WhatsApp Admin ke Customer: hanya event customer yang sesuai dan hanya dari Admin Utama.

### Rencana migrasi aman

1. Tambahkan adapter channel tanpa menghapus Telegram lama.
2. Emit event yang sama ke Notification Center dan Telegram, dengan dedupe ID sama.
3. Bandingkan delivery/log selama 14 hari.
4. Jadikan WhatsApp sebagai default; Telegram menjadi fallback bila WhatsApp internal gagal.
5. Setelah stabil 30 hari, hapus pemanggilan Telegram langsung dari service dan route; sisakan adapter resmi bila masih diperlukan.

## 9. Menu dashboard yang disarankan

```text
Dashboard
Operasional
  ├─ Pemasangan                 (baru: order workspace)
  ├─ Antrian Posting
  ├─ Invoice
  ├─ Pembayaran & QRIS
  └─ Keuangan

WhatsApp
  ├─ Overview Automation
  ├─ Flow Builder
  ├─ Pesan Tersimpan
  ├─ Keyword Automation
  ├─ Notification Center
  ├─ Admin Bot
  ├─ Logs & Webhook
  └─ Settings

Data
  └─ Database / master paket
```

Inbox tetap ditempatkan sebagai shortcut terpisah untuk order pemasangan yang sedang aktif, bukan menu CRM umum.

## 10. Tahapan implementasi

### Fase 1 — Command center dan order projection

- Halaman Pemasangan dengan status, filter, action queue, dan detail timeline.
- Projection read-only dari data yang sudah ada; tidak mengubah struktur transaksi lama.
- Dashboard mengganti kartu dekoratif menjadi kartu tindakan.
- Link silang dari Invoice, Pembayaran, Antrian, dan Inbox ke detail order.

Kriteria selesai: admin dapat melihat seluruh pekerjaan yang macet tanpa membuka empat menu berbeda.

### Fase 2 — Checklist dan automation pemasangan

- Checklist asset/data dan validasi transisi status.
- Template notifikasi: invoice, reminder, data kurang, pembayaran diterima, siap jadwal, dan terposting.
- Tombol tindakan dari detail order dan dedupe/queue melalui Notification Center.
- Pemasangan ulang dari data perusahaan sebelumnya.

Kriteria selesai: satu order dapat berjalan dari invoice sampai posted tanpa pencatatan status manual di banyak halaman.

### Fase 3 — WhatsApp Admin Bot sebagai remote control

- List menu interaktif untuk action utama.
- Command status order dan pekerjaan hari ini.
- Form invoice/order bertahap yang menghasilkan Order Pemasangan terhubung, bukan invoice lepas.
- Deep link aman dari bot ke dashboard.

Kriteria selesai: admin dapat membuat atau memantau order penting dari WhatsApp tanpa mengurangi audit dan validasi dashboard.

### Fase 4 — Konsolidasi Telegram

- Adapter channel, feature flag, telemetry delivery, dan fallback.
- Pemindahan semua pemanggilan Telegram langsung ke event bus.
- Evaluasi 30 hari sebelum Telegram tidak lagi menjadi default.

Kriteria selesai: setiap notifikasi memiliki satu event, satu dedupe key, satu log, dan channel dapat diubah tanpa mengedit business logic.

## 11. Data, audit, dan metrik keberhasilan

### Data yang perlu ditambahkan setelah projection stabil

- `placement_orders`: ID order, relasi ke invoice/posting, status, owner, due date, dan timestamps.
- `placement_order_assets`: jenis asset, URL, status validasi, dan pengunggah.
- `placement_order_events`: timeline immutable untuk perubahan status dan aksi admin/bot.
- `notification_deliveries`: bila belum cukup dari log yang ada, simpan event, channel, recipient, provider message ID, status, serta alasan gagal.

### Metrik produk

- Waktu dari request ke invoice dibuat.
- Conversion invoice dibuat → dibayar.
- Waktu dibayar → terposting.
- Jumlah order yang melewati SLA per hari.
- Persentase order yang perlu reminder poster/data.
- Delivery success WhatsApp internal dan customer.
- Jumlah langkah manual yang berhasil dikurangi per order.

## 12. Non-goals dan batasan

- Tidak membuat Inbox menjadi CRM customer umum atau ticketing jangka panjang.
- Tidak mengirim pesan customer dari nomor Bot.
- Tidak menambahkan AI chatbot sebelum order state, data, dan audit sudah rapi.
- Tidak menghapus Telegram sebelum delivery WhatsApp tervalidasi di production.
- Tidak melakukan migrasi besar tabel invoice/payment sekaligus; gunakan projection dan migrasi bertahap.

## 13. Rekomendasi eksekusi pertama

Mulai dari **Fase 1: halaman Pemasangan + dashboard command center**. Nilai bisnisnya paling besar, risiko rendah karena dapat membaca data yang sudah ada, dan menjadi fondasi untuk Bot WhatsApp, checklist asset, serta konsolidasi Telegram berikutnya.
