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
- Link QRIS publik (`/pay/{token}/qris`) memeriksa status order pada server. Jika sudah `PAID`, link tidak lagi menampilkan QR yang telah digunakan dan langsung mengarahkan ke `/payment/thankyou?order={order_id}`.

### Invoice manual dari WhatsApp

- Command `!buat_invoice` digunakan khusus sebagai bukti transaksi manual yang sudah dibayar, bukan untuk menagih atau membuat QRIS.
- Invoice Lowongan langsung tersimpan `PAID`/`paid` pada data transaksi dan invoice dashboard.
- Invoice Lengkap hanya meminta konfirmasi `LANJUT` pada tahap terakhir, lalu selalu tersimpan `PAID`/`paid`.
- Link bukti invoice manual tetap memakai `/pay/{nomor_invoice}` dan dapat dibuka ulang serta diunduh tanpa masa berlaku QRIS.
- Generator PDF/PNG pada halaman invoice publik kini memakai dokumen A4 terisolasi (bukan salinan tampilan mobile yang memiliki transform), sehingga hasil unduhan konsisten dengan desain invoice dan tidak gagal karena gaya responsif.

#### Alur command `!buat_invoice`

Command ini hanya boleh dipakai oleh admin sebagai **bukti transaksi manual yang sudah dibayar**. Command ini tidak membuat QRIS, tidak mengirim pengingat pembayaran, dan tidak memakai masa berlaku pembayaran.

1. Admin mengirim `!buat_invoice` ke bot.
2. Bot menghapus sesi invoice lama milik nomor admin tersebut, lalu menampilkan dua tombol:
   - **Invoice Lowongan** (`!inv_lowongan`)
   - **Invoice Lengkap** (`!inv_umum`)
3. Pilihan menentukan pertanyaan lanjutan dan jenis item invoice.

**A. Invoice Lowongan**

| Urutan | Data yang dimasukkan admin | Status sesi |
| --- | --- | --- |
| 1 | Pilih **Invoice Lowongan** | `LOWONGAN_AWAIT_NAME` |
| 2 | Nama perusahaan/klien | `LOWONGAN_AWAIT_WA` |
| 3 | Nomor WhatsApp klien (format `628...`) | `LOWONGAN_AWAIT_AMOUNT` |
| 4 | Nominal pemasangan | dibuat |

Hasil langkah 4:

- Membuat nomor `INV-{6 digit waktu}`.
- Menyimpan transaksi `payment_orders` sebagai `PAID` dengan `paid_at` saat invoice dibuat.
- Menyimpan invoice dashboard sebagai `paid` dengan satu item: **Loker Highlight**.
- Bot mengirim teks yang dapat diteruskan admin ke customer dengan link bukti: `https://infolokerjombang.net/pay/INV-...`.
- Customer dapat membuka invoice dan mengunduh PDF/PNG. Tidak ada halaman QRIS dari alur ini.

**B. Invoice Lengkap**

| Urutan | Data yang dimasukkan admin | Status sesi |
| --- | --- | --- |
| 1 | Pilih **Invoice Lengkap** | `UMUM_AWAIT_NAME` |
| 2 | Nama PT/klien | `UMUM_AWAIT_WA` |
| 3 | Nomor WhatsApp klien | `UMUM_AWAIT_PACKAGE` |
| 4 | Nama paket/layanan utama | `UMUM_AWAIT_PRICE` |
| 5 | Harga layanan utama | `UMUM_AWAIT_ADDON` |
| 6 | Add-on, atau ketik `TIDAK` | `UMUM_AWAIT_ADDON_PRICE` atau konfirmasi |
| 7 | Harga satu add-on, bila ada | konfirmasi |
| 8 | Ketik `LANJUT` | dibuat |

Hasilnya sama-sama membuat transaksi dan invoice `PAID`/`paid`, namun invoice berisi layanan utama beserta satu add-on opsional. Link invoice yang dibalas bot tetap `/pay/INV-...`.

#### Titik penambahan yang disarankan

Tambahkan data sebelum tahap konfirmasi `LANJUT`, lalu simpan ke `invoices`, `invoice_items`, dan/atau `payment_orders` sesuai kegunaannya. Penambahan yang paling berguna:

| Fitur | Letak pertanyaan | Penyimpanan |
| --- | --- | --- |
| Alamat/email klien | setelah nomor WhatsApp | `invoices.client_address` / data transaksi |
| Keterangan/catatan invoice | sebelum `LANJUT` | `invoices.notes` |
| Diskon | setelah nominal atau add-on | `discount_type`, `discount_value`, `discount_amount` |
| Pajak/PPN | setelah diskon | `tax_enabled`, `tax_percent`, `tax_amount` |
| Tanggal invoice atau tanggal pembayaran | sebelum `LANJUT` | `invoice_date`, `paid_at` |
| Banyak add-on | ulangi pertanyaan add-on sampai `SELESAI` | banyak baris `invoice_items` |
| Kirim invoice langsung ke customer | setelah invoice berhasil dibuat | template WA khusus bukti invoice lunas, dengan tombol URL ke `/pay/INV-...` |

Catatan implementasi: tahap `LANJUT` saat ini merupakan konfirmasi tampilan; sistem masih menerima teks apa pun pada tahap tersebut dan langsung membuat invoice. Jika command akan dipakai lebih luas, validasi ketat `LANJUT`/`BATAL` sebaiknya ditambahkan agar tidak salah membuat invoice.

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
- Saat QRIS dibuat, customer menerima CTA URL **Buka QRIS**. Setelah pembayaran terverifikasi, customer menerima CTA URL **Buka Invoice**. Tidak ada URL panjang di isi pesan dan setiap pesan hanya memiliki satu tombol link.
- Pengingat QRIS dijadwalkan lima menit setelah order dibuat dan dibatalkan otomatis bila order telah `PAID`, tidak lagi `PENDING`, atau QRIS kedaluwarsa. Pada paket Vercel Hobby, pemrosesan mandiri per lima menit memerlukan upgrade Vercel Pro atau scheduler eksternal; sementara itu pengingat diproses saat halaman QRIS melakukan polling, webhook masuk, atau cron harian berjalan.

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

## File migration untuk environment baru

- `supabase-migration-payment-test-package.sql`: paket internal ID 99 untuk test QRIS.
- `supabase-migration-poster-customer-notifications.sql`: seed template dan rule notifikasi poster.

Data tersebut **sudah diterapkan dan aktif di database production**. Tidak perlu menjalankan kedua file ini lagi pada production saat ini.

Simpan file migration sebagai referensi dan jalankan hanya ketika membuat database baru, environment staging baru, atau setelah data terkait memang sengaja dihapus. Migration paket tes bersifat idempoten, sedangkan migration poster dapat memperbarui rule notifikasi yang sudah ada; karena itu tetap hindari menjalankannya ulang tanpa kebutuhan.

## Checklist operasional singkat

1. Customer membuat order dan QRIS.
2. Pastikan invoice customer/admin dan laporan pembayaran admin muncul sesuai rule.
3. Customer upload poster dari langkah Upload Poster.
4. Pastikan dashboard **Admin / Antrean** menampilkan order dengan status `queued` dan URL poster.
5. Pastikan notifikasi poster customer serta laporan Bot ke Admin Utama memiliki status `delivered` di Logs/Notification Center.

## Changelog pekerjaan hari ini — 22 Juli 2026

Catatan persisten perubahan yang sudah dikerjakan dan dirilis hari ini:

### Pembayaran, QRIS, dan invoice

- Link customer dipisahkan: `/pay/{token}/qris` untuk QRIS dan `/pay/{token}` untuk invoice.
- Link invoice tidak lagi dikirim sebelum pembayaran pada alur payment otomatis; invoice customer dikirim setelah status berhasil.
- Batas pembayaran QRIS order baru diset 30 menit dan validasi pembayaran terlambat dicatat sebagai kedaluwarsa.
- Link QRIS yang order-nya sudah `PAID` otomatis redirect ke `/payment/thankyou?order=...`.
- Redirect pembayaran berhasil dari halaman payment dan halaman QRIS sudah diarahkan ke thank-you.
- Tampilan invoice mobile menggunakan skala responsif tanpa mengubah desain A4 desktop.
- Generator PDF/PNG invoice publik memakai dokumen A4 terisolasi agar tidak gagal karena transform mobile atau CSS responsif.
- Link invoice lama berbasis nomor invoice tetap kompatibel melalui fallback invoice publik.

### WhatsApp Notification Center

- CTA link WhatsApp menggunakan tombol URL: `Buka QRIS` sebelum bayar dan `Buka Invoice` setelah bayar.
- Pesan reminder pending dijadwalkan lima menit dan dilewati otomatis bila order sudah lunas/expired.
- Reminder diproses melalui polling QRIS, webhook, dan cron harian; Vercel Hobby belum mendukung cron setiap lima menit.
- Laporan bot ke Admin Utama tetap aktif untuk transaksi, pembayaran, poster, dan kejadian penting.
- Laporan untuk setiap chat customer dinonaktifkan agar tidak spam dan mengurangi risiko blokir.
- Aturan jendela WhatsApp menggunakan tepat 24 jam tanpa pengurangan, dengan alasan jelas di log jika diblokir.

### Poster dan antrean

- Upload poster melalui endpoint server yang memvalidasi token, status lunas, tipe file, dan ukuran maksimal.
- Poster yang diterima menautkan URL ke antrean posting dan mengirim notifikasi customer serta laporan admin.
- Paket uji coba ID 99 tersedia sebagai paket internal/nonaktif untuk menjaga foreign key antrean.
- Migration paket tes dan notifikasi poster sudah diterapkan di production; file hanya perlu dijalankan pada environment baru.

### Command WhatsApp `!buat_invoice`

- Invoice manual dipisahkan dari QRIS: langsung berstatus `PAID`/`paid`, tanpa reminder dan tanpa expiry.
- Invoice Lowongan tetap mendukung transaksi satu item cepat.
- Invoice Lengkap sekarang mendukung banyak paket/add-on, harga satuan, dan qty per item.
- Tersedia ringkasan total sebelum konfirmasi `LANJUT`; `BATAL` tidak membuat data.
- Setiap item disimpan sebagai baris terpisah di `invoice_items` dan link invoice tetap `/pay/INV-...`.
- PRD lengkap multi-item tersimpan di `docs/prd-buat-invoice-multi-item.md`.

### Verifikasi dan rilis

- Build Next.js/TypeScript lokal berhasil.
- Deployment production berhasil dan alias aktif: `https://infolokerjombang.net`.
- Endpoint link QRIS order contoh yang sudah lunas diverifikasi mengembalikan redirect `307` ke halaman thank-you.

### 9Router dan OpenCode

- 9Router lokal di `http://127.0.0.1:20128/v1` aktif dan `/v1/models` merespons.
- Combo `OpenCOde` terhubung ke beberapa model dan fallback `round-robin`; provider Nyoba serta Codex OAuth lulus tes provider.
- Error OpenCode ditemukan pada `opencode.json` level project: API key ditulis dengan kurung kurawal literal dan model masih menunjuk ke `9router/ar/gpt-5.5`.
- `opencode.json` project diperbaiki menjadi provider `9router/OpenCOde`, base URL `127.0.0.1`, dan API key tanpa kurung kurawal.
- OpenCode Windows `1.18.4` juga memunculkan `EEXIST` saat auto-update membuat folder konfigurasi yang sudah ada. Environment user `OPENCODE_DISABLE_AUTOUPDATE=1` sudah disimpan sebagai workaround.
- Tes akhir `opencode run --model 9router/OpenCOde` berhasil membalas `OK`.
- Node AgentRouter `ar` sebelumnya menunjuk ke `https://agentrouter.org/` (halaman web, bukan endpoint OpenAI-compatible). Endpoint node sudah diperbaiki menjadi `https://co.agentrouter.org/v1` sesuai dokumentasi AgentRouter.
- Setelah endpoint benar, tes langsung `ar/gpt-5.5` mengembalikan HTTP 401 `Invalid API Key` dari AgentRouter. Artinya API key AgentRouter pada koneksi `Nyoba` sudah tidak valid/kedaluwarsa dan perlu diganti di 9Router; ini berbeda dari password login 9Router dan berbeda dari API key lokal 9Router.
- Combo `OpenCOde` tetap teruji HTTP 200 melalui fallback Codex (`cx/gpt-5.6-sol`), sehingga OpenCode tetap dapat dipakai melalui combo selama koneksi AgentRouter belum diperbarui.

### Payment QRIS responsive dan alur poster

- Status PAID pada payment page sekarang melanjutkan customer ke step Upload Poster, bukan langsung ke thank-you.
- Countdown QRIS tidak lagi menetapkan expiry sendiri; status server menjadi sumber kebenaran dan timer/polling berhenti saat PAID/EXPIRED.
- Link QRIS publik yang sudah PAID melanjutkan ke sesi poster yang aman; jika poster sudah uploaded/deferred, link menuju thank-you.
- QRIS mobile memakai dynamic viewport, safe-area, scroll internal, dan ukuran QR adaptif untuk HP kecil, tablet, dan landscape.
- Tombol download QR hanya menangkap holder QR, bukan card pembayaran, instruksi, timer, atau tombol.
- Thank-you mobile kini memiliki tombol download invoice PNG dan PDF.
- Fallback notifikasi invoice admin yang memiliki link diubah ke `url_button`; laporan chat customer umum tetap nonaktif.
- Validasi sesi upload poster sekarang menerima `public_token` dari link QRIS sebagai pemulihan jika cache browser lama memiliki `upload_token` yang kedaluwarsa atau hilang. Status pembayaran dinormalisasi ke huruf besar dan endpoint mengembalikan alasan yang jelas (order tidak ditemukan, belum PAID, sesi kedaluwarsa, atau database tidak terbaca) tanpa mencatat token rahasia.
- Patch upload poster dipublikasikan ke production deployment `dpl_4HzzvmCiV5V5B7Wp1xMAT9uErShj` dan sudah dialias ke `https://infolokerjombang.net`.
- Validasi `npx tsc --noEmit` dan `npm run build` berhasil. Lint keseluruhan masih memiliki error baseline pada bundle Android dan komponen lama di luar perubahan ini.
