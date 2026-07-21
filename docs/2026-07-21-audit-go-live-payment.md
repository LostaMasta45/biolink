# Audit Go-Live Halaman Pembayaran

Tanggal audit: 21 Juli 2026  
Ruang lingkup: `/payment`, QRIS, invoice publik, webhook pembayaran, notifikasi WhatsApp, dashboard pembayaran, dan unggah poster.

## Kesimpulan singkat

Halaman `/payment` sudah mempunyai fondasi yang baik: katalog paket dan add-on, form pelanggan, pembuatan QRIS, halaman status, dashboard pembayaran, serta alur lanjutan unggah poster. Harga juga dihitung ulang di server, sehingga nominal dari browser tidak langsung dipercaya.

Namun, **belum aman untuk go-live penuh**. Ada beberapa celah prioritas-0 yang dapat membuat pembayaran berstatus lunas tanpa invoice/notifikasi/dashboard lanjutan yang lengkap, gagal mengunggah poster dari alur normal, atau mengirim WhatsApp di luar jendela percakapan yang diizinkan. Sebaiknya perbaikan P0 selesai dan diuji end-to-end sebelum promosi/traffic tinggi.

## Yang sudah tersedia dan layak dipertahankan

| Area | Kondisi saat ini | Catatan |
| --- | --- | --- |
| Pricelist | Paket dan add-on tersedia di `src/lib/payment-types.ts`. | Server menghitung ulang harga dari katalog internal, bukan harga kiriman browser. Ini sudah benar. |
| Form | Nama, WhatsApp, perusahaan, paket, dan add-on tersedia. | Bisa ditingkatkan dengan validasi dan consent. |
| Draft form | `localStorage` menyimpan `ilj_payment_form` dan pembayaran aktif menyimpan `ilj_active_payment`. | Kebutuhan cache dasar sudah ada, tetapi perlu dipertegas agar aman dan nyaman. |
| QRIS | API membuat QRIS dan UI memantau status pembayaran. | Perlu perbaikan idempotensi, polling, serta sinkronisasi status. |
| Dashboard | `/admin/pembayaran` membaca `payment_orders` dan menampilkan status/revenue. | Order sudah terlihat, tetapi data turunannya belum selalu konsisten. |
| Notifikasi | Notification Center sudah memiliki event pembayaran dan invoice, dengan Admin Utama sebagai pengirim ke pelanggan. | Event invoice belum dipicu secara konsisten dan perlu pemeriksaan jendela WhatsApp. |

## Temuan prioritas P0 — wajib sebelum go-live

### 1. Status lunas dari halaman polling dapat melewati proses invoice dan notifikasi

`GET /api/payment/status/[orderId]` dapat mengubah `payment_orders` menjadi `PAID` ketika provider melaporkan pembayaran sukses. Akan tetapi jalur ini tidak menjalankan seluruh proses yang ada di webhook: pencatatan finance, activity log, antrean posting, pembuatan invoice, dan notifikasi WhatsApp.

Dampak: pelanggan dapat melihat “lunas”, namun invoice tidak tercipta, admin tidak menerima notifikasi, atau dashboard operasional tidak lengkap—khususnya bila webhook terlambat/gagal.

Perbaikan:

1. Buat satu service server-side, misalnya `confirmPaidPayment(orderId, providerEvent)`, sebagai **satu-satunya** jalur untuk mengonfirmasi pembayaran.
2. Panggil service tersebut dari webhook terverifikasi dan proses rekonsiliasi/polling.
3. Gunakan transaksi/database function, lock transisi status, dan tabel event/outbox agar satu order hanya diproses sekali.
4. Bila efek samping gagal setelah pembayaran sah, tandai pekerjaan sebagai `pending_retry`; jangan melewatkannya hanya karena order sudah `PAID`.

### 2. Alur unggah poster reguler saat ini tidak cocok antara UI dan API

Halaman `/payment` mengirim `{ order_id, poster_urls, caption }` ke `/api/payment/upload-poster`, sementara API meminta `whatsapp_number`. Akibatnya alur normal berpotensi berhenti dengan pesan nomor WhatsApp wajib diisi.

Selain itu, API mencari draft posting berdasarkan nomor WhatsApp secara parsial, bukan berdasarkan order persis. Poster pelanggan A dapat berisiko tersambung ke draft yang salah ketika ada nomor/riwayat yang mirip.

Perbaikan:

1. Gunakan `order_id` sebagai identitas utama dari UI sampai database; jangan gunakan pencarian nomor parsial.
2. Verifikasi bahwa order benar-benar `PAID`, belum dibatalkan, dan upload session milik order tersebut.
3. Simpan media sebagai tabel/baris terstruktur atau JSON array, bukan string URL dipisahkan `|`.
4. Tambahkan validasi jumlah file, MIME type, ukuran, dimensi, domain Storage, dan status scan.
5. Jika pelanggan memilih “unggah nanti”, tampilkan tautan lanjutan yang aman dan dapat dipakai ulang, bukan langsung menampilkan proses selesai.

### 3. Invoice dan pembayaran belum memakai sumber data/relasi tunggal

Invoice otomatis baru dibuat setelah pembayaran lunas, memakai nomor acak, dan relasinya tidak disimpan kembali pada `payment_orders`. Sementara halaman publik `/pay/[orderId]` dapat menampilkan data dari `invoices` atau fallback `payment_orders`.

Dampak:

- tautan invoice dan ID pembayaran bisa berbeda/membingungkan;
- invoice tidak bisa ditelusuri kuat ke order asal;
- fallback menampilkan add-on berdasarkan ID add-on sebagai harga, sehingga nominal item dapat salah;
- nominal operasi menggunakan campuran `amount`, `total_amount`, dan `amount_paid`.

Perbaikan:

1. Buat invoice/dokumen tagihan saat order dibuat dengan status `issued` atau `pending_payment`, lalu ubah menjadi `paid` saat pembayaran tervalidasi.
2. Simpan relasi eksplisit: `payment_orders.invoice_id`, `invoices.payment_order_id`, `finance_transactions.payment_order_id`, dan `posting_queue.payment_order_id`.
3. Tetapkan satu nominal final, misalnya `payable_amount`, termasuk biaya/unique amount provider. Simpan juga `catalog_subtotal`, diskon, pajak, dan biaya secara terpisah.
4. Simpan snapshot line item `{code, name, qty, unit_price, subtotal}` ketika order dibuat. Jangan merekonstruksi harga dari ID add-on.
5. Gunakan invoice number yang unik di database, bukan angka acak tanpa proteksi collision.

### 4. “Customer sudah chat duluan” belum cukup untuk menjamin WhatsApp dapat dikirim

Secara kebijakan Meta/Kirim, pesan bebas (termasuk invoice teks) hanya dapat dikirim dalam jendela layanan 24 jam setelah pesan masuk terakhir pelanggan. Customer dapat mengisi nomor berbeda dari nomor yang pernah chat, atau jendela 24 jam bisa sudah berakhir saat pembayaran selesai. Dokumentasi Kirim menjelaskan batas tersebut serta dukungan `context.message_id` untuk membalas pesan inbound yang relevan: [Kirim — Send Text](https://docs.kirimdev.com/sending/send-text/).

Perbaikan:

1. Normalisasi nomor WA di server, lalu cari percakapan **Admin Utama** dengan nomor yang sama.
2. Tepat sebelum kirim, pastikan ada inbound message dan `service_window_expires_at > now()`.
3. Bila valid, kirim invoice dari Admin Utama; bila tersedia, gunakan `context.message_id` inbound terakhir agar percakapan tetap terhubung.
4. Bila jendela tidak valid, gunakan template Meta yang telah disetujui atau tampilkan/copy tautan invoice di halaman; jangan mencoba free-form text.
5. Di form, jelaskan: “Gunakan nomor WhatsApp yang dipakai untuk chat Admin Utama.” Ini membantu, tetapi validasi server tetap wajib.

### 5. Webhook dan pembuatan pembayaran belum cukup tahan duplikasi/kegagalan parsial

Pembuatan order menggunakan ID pendek berbasis tanggal dan `Math.random()`, belum ada idempotency key/rate limit/validasi runtime. QRIS dibuat sebelum insert database; bila insert gagal, QRIS provider bisa menjadi orphan. Webhook memeriksa data setelah membaca order lalu mengubah status, sehingga dua webhook bersamaan masih dapat memicu efek samping ganda.

Perbaikan:

1. Validasi request dengan Zod: panjang nama/perusahaan, paket/add-on valid, nomor E.164 Indonesia, dan batas payload.
2. Buat `idempotency_key` UUID dari browser; beri unique index `(customer_whatsapp_normalized, idempotency_key)` atau key global. Klik ulang tombol harus mengembalikan order/QR yang sama.
3. Gunakan ID order kriptografis atau sequence database dengan unique constraint dan retry collision.
4. Verifikasi webhook memakai mekanisme signature/HMAC, timestamp/replay protection, dan sumber resmi provider sesuai dokumentasinya—bukan sekadar membandingkan signature yang tersimpan di row.
5. Pakai outbox/event table unik per `provider_event_id` atau `(order_id, event_type)` untuk finance, invoice, posting queue, WhatsApp, dan Telegram.
6. Sediakan job rekonsiliasi berkala untuk `PENDING`/`PAID dengan efek samping yang belum selesai.

## Temuan prioritas P1 — penting untuk kualitas operasional

### Form, cache, dan pengalaman pelanggan

Cache form sudah ada, jadi pelanggan umumnya tidak perlu mengisi ulang saat refresh. Tetapi penyimpanannya masih sederhana dan dapat memulihkan pembayaran yang tidak cocok dengan identitas pelanggan saat ini.

Rekomendasi praktis:

- Simpan draft versi terstruktur: `schemaVersion`, `updatedAt`, nama, nomor ternormalisasi, perusahaan, paket, add-on, dan campaign. Terapkan TTL 14–30 hari untuk draft form.
- Simpan pembayaran aktif dengan `orderId`, `expiresAt`, dan hash identitas pelanggan; hanya lanjutkan jika order masih pending, belum kedaluwarsa, dan identitas cocok.
- Saat ada draft, tampilkan pilihan “Lanjutkan data sebelumnya” dan “Hapus data ini”, bukan memulihkan diam-diam.
- Debounce simpan draft 300–500 ms serta hapus otomatis setelah order/unggahan benar-benar selesai atau dibatalkan.
- Jangan menyimpan file poster, QR raw, token akses, atau URL bertanda tangan jangka panjang di `localStorage`.
- Tambahkan normalisasi nomor (`08…` menjadi `628…`), validasi format, pesan error per field, dan cegah submit ganda.
- Tambahkan checkbox persetujuan data/kebijakan privasi serta ringkasan order sebelum QR dibuat.

### QRIS dan status pembayaran

- Polling setiap 1 detik terlalu agresif. Gunakan 5–10 detik dengan backoff, pause saat tab tidak aktif, lalu cek ulang ketika tab kembali aktif.
- Tetap jadikan webhook terverifikasi sebagai sumber utama; polling hanya rekonsiliasi/UI.
- Tampilkan merchant, order ID, nominal final yang harus dibayar, waktu kedaluwarsa, tombol salin nominal/link invoice, dan status “menunggu konfirmasi bank”.
- Hindari reset form langsung saat QR kedaluwarsa. Simpan draft lalu sediakan “Buat QR baru” dengan idempotency yang jelas.

### Dashboard dan katalog harga

- Dashboard pembayaran sudah menampilkan order, tetapi sebaiknya memiliki tab/funnel: `Draft → Menunggu Bayar → Lunas → Menunggu Materi → Dijadwalkan → Terbit → Bermasalah`.
- Tambahkan tombol aksi dari satu row: buka invoice, salin link, kirim ulang WhatsApp (dengan pengecekan window/template), lihat log event, dan tandai perlu tindak lanjut.
- Harga paket masih hard-code dan terdapat paket test Rp1.000. Paket test harus dihapus/di-feature-flag dari produksi.
- Jadikan katalog harga satu sumber server-side/admin-managed dengan status aktif, tanggal efektif, dan audit perubahan. Order tetap menyimpan snapshot harga saat dibuat sehingga perubahan harga tidak mengubah order lama.
- Gunakan `payable_amount` konsisten pada dashboard revenue, invoice, finance, dan notifikasi.

### Keamanan dan privasi

- Endpoint status dan invoice publik saat ini mengandalkan ID yang dapat ditebak relatif mudah dan memuat PII. Gunakan token publik panjang/opaque (misalnya `public_token`) terpisah dari `order_id`, dengan expiry/revoke bila perlu.
- Terapkan RLS ketat; endpoint server yang membutuhkan akses operasional gunakan server client/service role secara aman, bukan anon key untuk operasi sensitif.
- Rate-limit endpoint create/status/upload; tambahkan bot protection ringan pada create payment.
- Catat audit event tanpa menyimpan isi sensitif berlebihan, serta tentukan retensi file poster dan data pelanggan.

## Desain alur yang direkomendasikan

```text
Pilih paket → isi/restore draft → validasi & normalisasi server
    → buat Order + Invoice Pending + snapshot harga (idempotent)
    → buat QRIS dan simpan detail provider
    → pelanggan bayar
    → webhook terverifikasi / rekonsiliasi
    → confirmPaidPayment (atomic)
        ├─ invoice = PAID
        ├─ finance transaction + activity log
        ├─ draft posting/order work item
        ├─ outbox: admin notification
        └─ outbox: customer invoice (cek 24 jam / template fallback)
    → upload poster lewat upload session milik order
    → status: siap dijadwalkan
```

Prinsipnya: pembayaran hanya dikonfirmasi di satu tempat; semua pekerjaan setelahnya dicatat sebagai event yang dapat dicoba ulang. Ini membuat sistem tetap konsisten walau webhook datang dua kali, provider lambat, atau WhatsApp sementara gagal.

## Rencana implementasi bertahap

### Tahap 1 — Go-live blocker

1. Perbaiki kontrak upload poster (`order_id`) dan verifikasi ownership/status order.
2. Ekstrak `confirmPaidPayment()` dan gunakan pada webhook serta status reconciliation.
3. Tambah idempotency, database unique constraints, validasi form server, dan webhook verification resmi provider.
4. Buat/simpan invoice pending + relasi order secara eksplisit; satukan nominal final.
5. Terapkan pengecekan WhatsApp 24-hour window/Admin Utama dan fallback template/link invoice.
6. Pastikan migration Notification Center sudah diterapkan di database produksi. Dokumen internal sebelumnya mencatat bahwa beberapa tabel notification center pernah belum ada di environment live; ini harus diverifikasi sebelum launch.

### Tahap 2 — Pengalaman profesional yang cepat dikerjakan

1. Upgrade cache draft dengan TTL, restore dialog, normalisasi nomor, dan tombol hapus draft.
2. Tambahkan halaman invoice publik bertoken dengan QR/link bayar aktif, breakdown harga snapshot, dan status real-time ringan.
3. Tambahkan dashboard funnel, event log, resend action, dan filter “butuh materi”.
4. Ubah “Lewati upload” menjadi “Unggah nanti” dengan secure continuation link dan reminder otomatis.
5. Kurangi polling QRIS dan tambahkan observability: webhook received, verified, processed, notification queued/sent/failed.

### Tahap 3 — Penyempurnaan operasional

1. Katalog harga dikelola admin dengan tanggal berlaku dan audit log.
2. Reminder otomatis untuk QR hampir kedaluwarsa, invoice belum bayar, dan materi poster belum diunggah.
3. Rekonsiliasi harian dengan provider pembayaran dan laporan order yang side effect-nya belum lengkap.
4. Download invoice PDF/receipt, email opsional, serta halaman pelanggan untuk melanjutkan unggah materi.

## Checklist uji sebelum rilis

- [ ] Order dibuat dua kali karena klik/refresh hanya menghasilkan satu QR/order aktif.
- [ ] Pembayaran sukses dari webhook menghasilkan tepat satu invoice, transaksi finance, posting draft, log, dan notifikasi admin/pelanggan.
- [ ] Pembayaran sukses yang hanya terdeteksi saat polling tetap menjalankan proses lengkap yang sama.
- [ ] Webhook yang dikirim dua kali tidak menduplikasi invoice, finance, atau notifikasi.
- [ ] Kegagalan WhatsApp/Telegram dapat dicoba ulang tanpa mengubah pembayaran atau menggandakan invoice.
- [ ] Nomor yang belum chat atau jendela 24 jam berakhir memakai template/fallback, bukan pesan bebas.
- [ ] Upload poster dari alur `/payment` berhasil, hanya dapat mengubah order sendiri, dan tidak dapat menaut ke order lain.
- [ ] Nominal QRIS, invoice, dashboard, finance, dan pesan WhatsApp sama persis.
- [ ] QRIS expired tidak menghapus draft pelanggan; pelanggan dapat membuat ulang QR dengan data yang sama.
- [ ] Paket test tidak terlihat di produksi, semua secret/provider credential aman, dan RLS/rate limit sudah diuji.

## Keputusan go-live

**Belum direkomendasikan untuk go-live penuh sebelum seluruh P0 diselesaikan.** Setelah P0 dan checklist inti lulus di environment staging dengan transaksi QRIS nyata/test resmi, alur ini akan jauh lebih dapat diandalkan: pelanggan tidak perlu mengisi ulang, pembayaran tidak kehilangan proses lanjutan, invoice konsisten, dan WhatsApp tetap patuh pada batas percakapan.
