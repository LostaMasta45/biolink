# Implementasi Penguatan Payment Go-Live

Tanggal: 21 Juli 2026  
Status: implementasi kode selesai; migration database wajib diterapkan sebelum deploy produksi.

## Ringkasan perubahan

Perbaikan ini menyatukan alur `/payment` dari pembuatan order sampai invoice, finance, antrean posting, dan unggah poster. Integrasi pengiriman WhatsApp tidak diubah/ditambah pada pekerjaan ini. Form hanya diberi keterangan agar pelanggan menggunakan nomor yang sebelumnya dipakai untuk chat admin.

## Perubahan yang diterapkan

### Order dan QRIS

- Endpoint `POST /api/payment/create` sekarang memakai validasi Zod untuk nama, perusahaan, nomor WhatsApp, paket, add-on, dan idempotency key.
- Nomor WhatsApp dinormalisasi ke format `628…` di server.
- Setiap percobaan pembayaran memakai UUID idempoten. Klik tombol berulang/retry dengan sesi yang sama akan mengembalikan order QRIS yang sama, bukan membuat tagihan ganda.
- ID order memakai UUID acak yang dipendekkan, bukan `Math.random()` pendek.
- Paket uji coba Rp1.000 diberi status tidak tersedia sehingga tidak tampil di `/payment` produksi.
- Harga disimpan sebagai snapshot line item di order. Nominal final `payable_amount` dipakai konsisten untuk QRIS, invoice, finance, dan dashboard.
- QRIS dibuat setelah row order lokal tercatat. Jika provider gagal, order diberi status `CANCELLED` dan alasan disimpan di `processing_error`.

### Konfirmasi pembayaran dan sinkronisasi

- Dibuat service tunggal `src/services/payment-order-service.ts`.
- Webhook dan endpoint status QRIS memakai `confirmPaidPayment()` yang sama.
- Proses ini secara idempoten memastikan invoice, transaksi finance, dan draft posting selalu tersedia untuk order yang sudah lunas.
- Saat sinkronisasi turunan gagal, error disimpan dan endpoint status akan mencoba sinkronisasi ulang ketika order lunas dicek kembali.
- Event provider direkam di `payment_events` untuk audit dan deduplikasi.
- Dashboard pembayaran memakai `payable_amount` sebagai nominal utama revenue.

### Invoice publik

- Invoice otomatis dibuat ketika QRIS berhasil dibuat dengan status `pending`, lalu berubah `paid` saat pembayaran terkonfirmasi.
- Invoice memiliki relasi eksplisit dengan `payment_order_id`; order menyimpan `related_invoice_id`.
- Line item invoice berasal dari snapshot harga, sehingga add-on tidak lagi keliru ditampilkan dengan ID sebagai harga.
- Tautan invoice payment baru memakai `public_token` opaque di `/pay/[token]`, bukan order ID yang mudah ditebak.
- Invoice manual/lama tetap didukung melalui nomor invoice agar tautan lama tidak langsung putus.

### Form, cache, dan poster

- Cache form ditingkatkan menjadi `ilj_payment_form_v2`: memiliki `schemaVersion`, `updatedAt`, debounce 350 ms, dan masa berlaku 30 hari.
- Cache pembayaran aktif memakai `ilj_active_payment_v2`; expired payment hanya menghapus cache pembayaran, bukan menghapus data form pelanggan.
- Order aktif hanya dapat dilanjutkan bila paket, add-on, nama, perusahaan, dan nomor WhatsApp cocok.
- Copywriting pada form: **“Gunakan nomor WhatsApp yang sebelumnya dipakai untuk chat admin agar data pesanan mudah kami cocokkan.”**
- Polling status QRIS diubah dari 1 detik menjadi 7 detik dan berhenti ketika tab tidak aktif; pengecekan langsung berjalan ketika pelanggan kembali ke tab.
- Upload poster sekarang harus membawa `order_id` dan `upload_token` milik order, memverifikasi status `PAID`, serta selalu menaut ke satu `posting_queue.order_id` yang tepat.
- Maksimum 10 poster, URL wajib berasal dari bucket `posters`, dan metadata poster disimpan terstruktur dalam `poster_urls` sambil mempertahankan `poster_url` lama untuk kompatibilitas dashboard.
- Tombol “Kirim Poster Nanti” sekarang menyimpan status `deferred`, bukan hanya menampilkan sukses tanpa catatan.

## File utama

| File | Fungsi |
| --- | --- |
| `supabase-migration-payment-go-live.sql` | Schema, index unik, token publik, snapshot harga, relasi invoice/finance/posting, dan payment events. |
| `src/lib/payment-order.ts` | Validasi input, normalisasi nomor, snapshot harga, ID order. |
| `src/services/payment-order-service.ts` | Orkestrasi pembuatan order dan konfirmasi pembayaran idempoten. |
| `src/app/api/payment/*` | API create, status, webhook, upload poster, dan defer poster. |
| `src/app/payment/page.tsx` | Cache form, idempotency, copywriting nomor WA, upload/defer poster. |
| `src/components/payment/qris-display.tsx` | Polling lebih hemat dan token status. |
| `src/app/pay/[orderId]/*` | Invoice publik bertoken dan snapshot line item. |

## Langkah deploy yang wajib

1. Backup database produksi.
2. Jalankan `supabase-migration-payment-go-live.sql` melalui Supabase SQL Editor pada environment target.
3. Pastikan `SUPABASE_SERVICE_ROLE_KEY` tersedia di environment server production. Jangan pernah mengekspos key ini ke browser.
4. Deploy aplikasi setelah migration berhasil.
5. Setelah deploy tervalidasi, hapus tiga policy publik `payment_orders` yang dikomentari pada bagian akhir migration agar browser tidak dapat membaca/menulis seluruh tabel payment.

Migration tidak dijalankan otomatis dari workspace ini karena itu mengubah database target secara langsung; file migration sudah disiapkan untuk diterapkan secara terkontrol pada environment yang benar.

## Verifikasi yang telah dijalankan

```text
npx tsc --noEmit
```

Hasil: lulus tanpa error.

Lint terarah juga dijalankan. Tidak ada error pada file payment baru/yang diubah; peringatan tersisa hanyalah penggunaan tag `<img>` lama di komponen UI. Peringatan tersebut tidak menghalangi build, tetapi dapat dimigrasikan ke `next/image` pada perapihan UI berikutnya.

## Uji manual setelah migration

- Buat pembayaran lalu refresh/klik ulang: harus tetap satu order QRIS.
- Bayar QRIS dari webhook dan dari status reconciliation: keduanya harus menghasilkan satu invoice, satu transaksi, dan satu draft posting.
- Kirim webhook sukses dua kali: tidak boleh ada data ganda.
- Buka invoice dari token publik; coba membuka dengan order ID asli: harus tidak ditemukan untuk payment baru.
- Upload poster dengan token benar, token salah, order belum lunas, dan URL non-bucket: hanya kondisi benar yang boleh berhasil.
- Pilih “Kirim Poster Nanti”: status order serta posting berubah menjadi `deferred`.
- Biarkan QRIS expired: form tetap tersimpan dan pelanggan dapat membuat QR baru tanpa mengisi ulang.

## Batasan yang disengaja

Atas arahan saat ini, logika kelayakan WhatsApp 24 jam/template invoice tidak diubah. Sistem hanya menampilkan copywriting agar pelanggan memasukkan nomor yang sebelumnya dipakai untuk chat admin. Integrasi WhatsApp lama tetap berjalan seperti sebelumnya.
