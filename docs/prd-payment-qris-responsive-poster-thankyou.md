# PRD Implementation — Payment QRIS Responsive, Upload Poster, dan Thank You

## 1. Ringkasan

Perbaikan ini mencakup alur:

~~~text
Pilih paket → isi data → QRIS → PAID → upload poster/lewati → thank-you → invoice PDF/PNG + notifikasi
~~~

Fokusnya adalah responsivitas semua HP/tablet, state pembayaran yang benar, poster sebagai langkah setelah pembayaran, download invoice mobile, dan laporan WhatsApp yang efisien. Desain invoice desktop/A4 tidak diubah.

## 2. Analisis kondisi saat ini

### 2.1 Pembayaran berhasil melewati upload poster

File 'src/app/payment/page.tsx' saat ini membuat callback payment success langsung redirect ke '/payment/thankyou'. Akibatnya step '4. Upload Poster' dilewati.

### 2.2 Popup expiry muncul setelah PAID

File 'src/components/payment/qris-display.tsx' memiliki interval countdown yang tetap berjalan setelah status berubah menjadi 'PAID'. Saat timer mencapai nol, callback expiry tetap dipanggil. Expiry lokal tidak boleh mengalahkan status PAID dari server.

### 2.3 QRIS mobile dapat terpotong

Layout mobile QRIS memakai 'fixed inset-0' dan konten flex penuh, tetapi belum memiliki scroll internal yang konsisten. Pada HP kecil, viewport pendek, atau landscape, instruksi dan tombol dapat berada di luar layar. Padding, ukuran QR, notch, dan safe-area juga perlu ditangani.

### 2.4 Thank-you mobile belum punya tombol invoice

Versi desktop thank-you sudah memiliki PDF/PNG. Versi mobile hanya memiliki tombol WhatsApp dan kembali ke beranda.

### 2.5 Notifikasi

Template customer QRIS/invoice sudah memakai 'url_button'. Beberapa laporan admin masih 'text' dan menaruh URL langsung di body. Pesan yang memiliki URL harus memakai tombol URL dan maksimal satu link utama. Laporan setiap chat customer tetap nonaktif.

## 3. Tujuan

1. QRIS dapat dipakai pada HP kecil, HP standar, tablet portrait, dan landscape.
2. Pembayaran PAID tidak pernah memunculkan popup expiry.
3. Setelah PAID, customer selalu masuk ke upload poster sebelum thank-you.
4. Upload berhasil, defer, dan gagal memiliki state jelas serta dapat dilanjutkan.
5. Thank-you desktop dan mobile memiliki PDF serta PNG.
6. File download memiliki data/desain yang sama dengan invoice asli.
7. Bot melaporkan pembayaran, poster, dan kejadian penting ke Admin Utama tanpa spam chat.
8. Setiap pesan WhatsApp ber-link memakai tombol URL.

## 4. Non-goals

- Tidak mengubah desain invoice A4 yang sudah disetujui.
- Tidak mengubah durasi expiry server/provider pada fase ini.
- Tidak mengaktifkan kembali laporan untuk setiap chat customer.
- Tidak membuat QRIS baru ketika refresh atau kembali ke halaman.
- Tidak menambah link yang tidak diperlukan pada pesan WhatsApp.

## 5. Alur target

### 5.1 Payment page utama

1. Customer memilih paket/add-on dan mengisi data.
2. Sistem membuat order PENDING dan menampilkan QRIS.
3. Selama PENDING, countdown dan polling berjalan.
4. Server mengembalikan PAID: hentikan countdown/polling, tampilkan konfirmasi, pindah ke step '4. Upload Poster', dan jangan redirect ke thank-you.
5. Customer upload poster atau memilih 'Lewati, Kirim Poster Nanti'.
6. Setelah endpoint upload/defer sukses: simpan poster_status, kirim notifikasi secara idempoten, hapus cache sesi, lalu redirect ke '/payment/thankyou?order=...'.
7. Jika upload gagal, tetap di step poster dan sediakan coba lagi.

### 5.2 Link QRIS dari WhatsApp

Link tetap '/pay/{public_token}/qris'.

- PENDING: tampilkan QRIS.
- PAID dengan poster pending: lanjut ke halaman upload poster yang aman.
- PAID dengan poster uploaded/deferred: redirect ke thank-you.
- EXPIRED/CANCELLED: tampilkan status dan opsi ulangi.
- Refresh/retry tidak membuat order atau notifikasi ganda.

Untuk link publik tanpa localStorage, gunakan sesi poster singkat yang diterbitkan server berdasarkan public_token dan status PAID. Jangan mengirim service-role key atau kredensial database ke browser.

### 5.3 Expiry

Expiry hanya sah jika status server masih PENDING, expired_at sudah lewat, dan pemeriksaan status/provider tidak mengembalikan PAID. Jika PAID sudah tercatat, PAID selalu menang atas countdown lokal.

## 6. Spesifikasi responsive UI

### 6.1 Prinsip layout

- Gunakan 100dvh dengan fallback 100vh.
- Container QRIS mobile memakai min-h-0 dan overflow-y-auto.
- Tambahkan env(safe-area-inset-top) dan env(safe-area-inset-bottom).
- Hindari elemen fixed yang tidak memiliki scroll internal.
- Ukuran QR adaptif, misalnya min(72vw, 280px).
- Gunakan break-words/overflow-wrap untuk teks panjang.
- Tinggi tombol minimum 44px.
- Cegah horizontal overflow pada seluruh halaman.

### 6.2 Matriks QA

| Kategori | Viewport |
| --- | --- |
| HP kecil | 320×568, 360×640 |
| HP standar | 375×667, 390×844, 412×915 |
| Tablet portrait | 600×960, 768×1024 |
| Landscape pendek | 667×375, 844×390 |

Pada semua viewport: QR utuh dan dapat dipindai, timer terlihat saat pending, tombol dapat disentuh, instruksi dapat discroll, tidak ada horizontal scroll, dan keyboard tidak menutup field/submit.

## 7. Implementasi teknis

### 7.1 QrisDisplay

1. Timer hanya aktif ketika status PENDING.
2. Clear interval segera ketika status menjadi PAID atau EXPIRED.
3. Gunakan guard agar callback sukses/expired hanya dipanggil sekali.
4. Saat response PAID, set status lokal, hentikan polling, lalu panggil callback parent.
5. Saat countdown habis, lakukan satu status check server terakhir sebelum expiry.
6. Jangan panggil expiry jika komponen sudah unmount atau status sudah PAID.
7. Polling visibility tetap boleh dijalankan saat tab kembali aktif.

### 7.2 PaymentContent

Ubah callback payment success dari redirect thank-you menjadi setStep(4). Jangan hapus ilj_active_payment_v2 sebelum upload/defer berhasil.

Setelah upload/defer sukses: hapus cache payment/form, tampilkan toast sukses, redirect ke thank-you dengan order_id, dan cegah double-submit dengan loading state serta dedupe server.

### 7.3 Public QRIS

Tambahkan poster_status ke keputusan redirect. Untuk flow publik yang belum memiliki sesi, gunakan endpoint pembuat sesi poster singkat dengan prinsip least privilege. Komponen upload poster sebaiknya direuse agar validasi file, pesan error, dan notifikasi sama dengan payment page utama.

### 7.4 Thank-you dan invoice

Tambahkan card download di mobile dengan Download PNG dan Download PDF. Gunakan renderer invoice yang sama untuk desktop/mobile/PDF/PNG. Jangan menggambar invoice berdasarkan ukuran layar mobile.

Generator wajib A4 portrait konsisten, aset/logo tidak gagal karena CORS, tombol tidak ikut masuk ke file, nama file aman, loading/sukses/error jelas, fallback server/shared renderer bila generator client gagal, dan isi invoice sama dengan halaman asli.

## 8. WhatsApp dan laporan Admin Utama

| Event | Penerima | Tipe | Link |
| --- | --- | --- | --- |
| QRIS dibuat | Customer | url_button | Satu tombol Buka QRIS |
| Reminder pending | Customer | url_button | Satu tombol Buka QRIS |
| Pembayaran berhasil | Customer | url_button | Satu tombol Buka Invoice |
| Pembayaran berhasil | Admin Utama | text atau url_button bila ada link dashboard | Maksimal satu link |
| Poster masuk antrean | Customer | text bila hanya konfirmasi | Tidak wajib link |
| Poster masuk antrean | Admin Utama | url_button bila ada link antrean/poster | Satu tombol Buka Antrean |

Event chat customer umum tetap nonaktif. Dedupe memakai order_id + jenis event sehingga polling, webhook, refresh, dan retry tidak menggandakan pesan.

Log minimal: payment.paid, poster.received, poster.deferred, notification.sent/queued/failed, payment.expiry_ignored_paid, payment.ui.transition_paid_to_poster, dan payment.ui.transition_poster_to_thankyou.

## 9. Data dan endpoint

Pertahankan payment_orders dengan status PENDING/PAID/EXPIRED/CANCELLED, poster_status pending/uploaded/deferred, paid_at saat PAID, processed_at setelah sinkronisasi, dan expired_at yang hanya menentukan expiry ketika PENDING.

Endpoint yang diverifikasi: POST /api/payment/create, GET /api/payment/status/{orderId}?token=..., POST /api/payment/upload-poster-file, POST /api/payment/upload-poster, POST /api/payment/defer-poster, dan webhook QRIS PAID/EXPIRED.

## 10. Acceptance criteria

### Payment dan expiry

1. QRIS usable pada seluruh matriks viewport.
2. PAID masuk ke upload poster, bukan thank-you.
3. Menunggu setelah PAID tidak memunculkan popup expiry.
4. Refresh setelah PAID tidak membuat order baru.
5. Webhook PAID dan polling PAID menghasilkan UI yang sama.
6. Order benar-benar expired menampilkan status expired dan opsi ulangi.

### Poster

1. Minimal satu poster dapat diupload dari HP kecil, HP standar, tablet, dan desktop.
2. File invalid/besar ditolak tanpa menghapus file valid lain.
3. Upload gagal dapat dicoba ulang.
4. Defer menyimpan poster_status=deferred dan dapat menuju thank-you.
5. Upload/defer hanya mengirim notifikasi satu kali per order.

### Thank-you dan invoice

1. Thank-you mobile memiliki PDF dan PNG.
2. Download berhasil pada Chrome Android, Safari iOS, dan desktop modern.
3. PDF/PNG identik secara data/desain dengan invoice.
4. Invoice hanya LUNAS setelah PAID.
5. Link invoice lama tetap dapat dibuka dan diunduh.

### Admin

1. Admin menerima laporan pembayaran berhasil.
2. Admin menerima laporan poster masuk/defer.
3. Link dikirim sebagai tombol URL.
4. Tidak ada laporan setiap chat customer.
5. Retry tidak menggandakan pesan.

## 11. Rencana pengerjaan

### Fase 1 — State correctness

Perbaiki lifecycle timer/polling, ubah callback PAID menjadi step poster, ubah redirect QRIS publik berdasarkan poster status, dan tambahkan test race condition PAID-versus-expiry.

### Fase 2 — Responsive UI

Terapkan dynamic viewport, safe-area, scroll internal, ukuran QR/padding/typography adaptif, dan uji seluruh viewport target.

### Fase 3 — Poster dan thank-you

Reuse komponen upload, tambahkan download mobile, satukan renderer invoice, dan siapkan fallback generator.

### Fase 4 — Notification hardening

Pastikan tipe template dan tombol URL benar, tambahkan satu link dashboard/antrean jika diperlukan, dan verifikasi dedupe/activity log.

### Fase 5 — Release verification

Jalankan lint/typecheck/build. Uji test package, webhook PAID, polling PAID, expiry asli, refresh, retry upload, defer, download, WhatsApp customer/Admin Utama, dan log.

## 12. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Webhook terlambat | Polling server authoritative dan idempotent |
| Timer berbeda dari server | Status server mengalahkan countdown |
| Upload besar gagal | Validasi, progress, retry per file, error spesifik |
| PDF/PNG gagal karena CORS | Renderer terisolasi, aset inline/server fallback |
| Pesan admin spam | Dedupe per event dan chat umum tetap nonaktif |
| Token upload bocor | Public token + sesi poster singkat, tanpa service-role key |

## 13. Definition of Done

Semua acceptance criteria lulus, build production berhasil, popup expiry tidak muncul setelah PAID, flow selalu melewati poster sebelum thank-you, invoice mobile dapat diunduh PDF/PNG, dan Admin Utama menerima satu laporan untuk setiap transaksi/kejadian penting.

