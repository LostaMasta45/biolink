# PRD — Link Text WhatsApp untuk QRIS dan Invoice

Status: **Ready for implementation**
Tanggal revisi: **23 Juli 2026**
Area: Payment QRIS, invoice publik, WhatsApp Notification Center, Kirim.dev

## 1. Keputusan produk

Berdasarkan tes langsung pada perangkat pengguna:

- link dari pesan bertipe `url_button` dibuka di browser internal WhatsApp;
- URL yang ditulis langsung di pesan bertipe `text` dibuka di browser eksternal;
- download QR dan invoice kemudian dapat berjalan melalui browser eksternal tersebut.

Karena itu, solusi utama direvisi menjadi:

1. Ubah tiga notifikasi customer dari `url_button` menjadi `text`.
2. Tulis URL lengkap sebagai teks biasa di body pesan.
3. Pertahankan isi, nada bahasa, variable, routing, delay, dan dedupe rule yang sudah dikonfigurasi.
4. Gunakan `preview_url: false` pada rollout awal agar URL terlihat jelas dan customer mengklik URL mentah, bukan kartu preview.
5. Verifikasi pada perangkat nyata menggunakan paket tes sebelum rollout penuh.

Tombol CTA, media native, Android intent, dan pemaksaan browser eksternal tidak diperlukan untuk perbaikan awal.

## 2. Kondisi produksi saat ini

Pengecekan read-only pada 23 Juli 2026 menunjukkan:

| Event | Template produksi | Tipe saat ini | Tujuan |
| --- | --- | --- | --- |
| `invoice.created.customer` | QRIS Baru Customer | `url_button` | `/pay/{public_token}/qris` |
| `invoice.reminder.customer` | Pengingat QRIS Customer | `url_button` | `/pay/{public_token}/qris` |
| `payment.paid.customer` | Invoice Setelah Pembayaran | `url_button` | `/pay/{public_token}` |

Ketiga rule aktif. `media_url` tidak digunakan.

### 2.1 Jalur kode

- `src/services/whatsapp-notification-service.ts`
  - Membuat `payment_url` dan `invoice_url` menggunakan opaque `public_token`.
  - Fallback ketiga event masih bertipe `url_button`.
- `src/services/kirimdev-mapper.ts`
  - Template `url_button` dikirim melalui `sendCtaUrlMessage`.
  - Template `text` sudah didukung melalui `sendTextMessage`.
- `src/lib/whatsapp/kirimdev-client.ts`
  - `sendTextMessage` sudah menerima parameter `previewUrl`.
- `src/components/payment/qris-display.tsx`
  - Menyediakan download QR.
- `src/app/pay/[orderId]/InvoiceClient.tsx`
  - Menyediakan download PDF/PNG invoice.

Artinya, perubahan utama berada pada konfigurasi template dan fallback notification. Sistem pengiriman text dan variable renderer sudah tersedia.

## 3. Analisis akar masalah

Masalah bukan berasal dari URL QRIS atau invoice yang salah. URL yang sama memberikan perilaku berbeda berdasarkan bentuk pesan WhatsApp:

~~~text
interactive url_button
  -> browser internal WhatsApp
  -> download QR/PDF gagal pada perangkat pengguna

text message + raw HTTPS URL
  -> browser eksternal
  -> download QR/PDF berhasil
~~~

Perilaku ini merupakan hasil empiris pada perangkat target, bukan kontrak lintas versi WhatsApp. Karena itu:

- hasil tes pengguna menjadi dasar solusi produksi saat ini;
- rollout harus tetap memakai feature flag atau perubahan template yang mudah dikembalikan;
- link dan halaman download tetap perlu diuji setiap kali WhatsApp mengalami pembaruan besar.

## 4. Tujuan

1. Klik link QRIS dari WhatsApp membuka browser eksternal pada perangkat target.
2. Klik link invoice dari WhatsApp membuka browser eksternal pada perangkat target.
3. Customer dapat menyimpan QR dan invoice menggunakan download yang sudah tersedia.
4. Isi pesan tetap mengikuti template Notification Center.
5. Tidak ada perubahan routing Admin Utama/Bot/customer.
6. Webhook, polling, reconciliation, dan retry tidak menggandakan pesan.
7. Paket tes tetap tersedia untuk pengujian.
8. Tidak ada `public_token` atau `upload_token` yang ditulis ke log aplikasi.

## 5. Non-goals

- Tidak membuat redirect ke Chrome/Safari.
- Tidak menggunakan `intent://`.
- Tidak menambahkan aplikasi customer.
- Tidak mengirim QR atau invoice sebagai media pada fase awal.
- Tidak membuat generator download baru pada fase awal.
- Tidak mengubah halaman payment/invoice bila tes membuktikan halaman tersebut sudah bekerja di browser eksternal.
- Tidak mengubah template admin yang tidak terkait.
- Tidak menghapus paket tes.

## 6. Scope perubahan P0

### 6.1 Template QRIS baru

Event: `invoice.created.customer`
Tipe target: `text`
Preview URL: `false`

Struktur body:

~~~text
Halo Kak {{customer_name}} 👋

QRIS untuk *{{package_name}}* senilai *Rp {{amount}}* sudah siap.

Buka QRIS dan selesaikan pembayaran melalui link berikut:
{{payment_url}}

Terima kasih.
~~~

Catatan:

- Copy final tetap mengambil template aktif di Notification Center.
- PRD hanya mensyaratkan `{{payment_url}}` hadir sebagai URL mentah pada baris tersendiri.
- Jangan menambahkan tombol URL.

### 6.2 Template reminder QRIS

Event: `invoice.reminder.customer`
Tipe target: `text`
Preview URL: `false`

Struktur body:

~~~text
Halo Kak {{customer_name}} 👋

Pembayaran QRIS untuk *{{package_name}}* sebesar *Rp {{amount}}* masih menunggu.

Lanjutkan pembayaran melalui link berikut:
{{payment_url}}

Jika sudah membayar, pesan ini dapat diabaikan. Terima kasih.
~~~

### 6.3 Template invoice setelah pembayaran

Event: `payment.paid.customer`
Tipe target: `text`
Preview URL: `false`

Struktur body:

~~~text
Halo Kak {{customer_name}} 👋

Pembayaran untuk *{{package_name}}* sebesar *Rp {{amount}}* telah berhasil kami terima. ✅

Buka dan download invoice melalui link berikut:
{{invoice_url}}

Poster dan pesanan Kakak akan segera kami proses.
Terima kasih — Admin InfoLokerJombang
~~~

### 6.4 Persyaratan URL

- QRIS menggunakan `{{payment_url}}`.
- Invoice menggunakan `{{invoice_url}}`.
- URL harus HTTPS absolut.
- URL ditempatkan pada baris tersendiri.
- Tidak dibungkus Markdown, tanda kurung, atau karakter yang dapat menjadi bagian URL.
- Tidak menggunakan URL shortener pihak ketiga.
- Tidak menggunakan `order_id` sebagai kredensial.
- Link tetap memakai opaque `public_token`.

## 7. Perubahan teknis

### 7.1 Database/Notification Center

Untuk ketiga template customer:

- ubah `type` menjadi `text`;
- pindahkan URL dari `buttons[0].url` ke `body`;
- set `preview_url = false`;
- kosongkan `buttons` jika schema mengizinkan;
- jangan mengubah `notification_rules.template_id`;
- jangan mengubah `recipient_type`, `sender_role`, `delay_seconds`, `max_attempts`, atau `dedupe_window_seconds`.

Perubahan database harus memakai migration idempoten yang menargetkan event/template secara tepat. Jangan melakukan update massal terhadap semua template `url_button`.

### 7.2 Fallback kode

Ubah fallback untuk:

- `invoice.created.customer`;
- `invoice.reminder.customer`;
- `payment.paid.customer`.

Dari:

~~~ts
type: "url_button"
buttons: [{ url: "{{..._url}}" }]
~~~

Menjadi:

~~~ts
type: "text"
body: "...\\n{{..._url}}\\n..."
preview_url: false
~~~

Tujuannya agar perilaku tetap sama jika tabel/rule Notification Center sementara tidak tersedia.

### 7.3 Mapper/Kirim.dev

Tidak diperlukan tipe pesan baru. Alur yang sudah ada digunakan:

~~~text
TemplateData.type === "text"
  -> sendTextMessage(...)
  -> payload type: "text"
  -> text.body berisi URL mentah
  -> text.preview_url: false
~~~

Tambahkan atau pertahankan test yang memastikan:

- variable URL dirender sebelum dikirim;
- payload tidak memiliki `interactive`;
- payload tidak memiliki `action.name = cta_url`;
- `preview_url` bernilai false;
- tidak ada placeholder `{{payment_url}}` atau `{{invoice_url}}` tersisa.

### 7.4 Admin UI

Notification Center harus menampilkan template tersebut sebagai `Text`, bukan `Tombol URL`.

Validasi:

- body wajib berisi variable URL yang sesuai dengan event;
- test-send harus memakai URL aman/test, bukan token produksi customer;
- perubahan tipe tidak boleh menghapus body template tanpa konfirmasi;
- preview pesan memperlihatkan URL mentah.

## 8. Alur target

### 8.1 QRIS baru

~~~text
Order PENDING dibuat
  -> notification job invoice.created.customer
  -> template text dirender
  -> WhatsApp menampilkan URL mentah
  -> customer klik URL
  -> browser eksternal terbuka
  -> halaman QRIS tampil
  -> customer download QR
~~~

### 8.2 Reminder

~~~text
Order masih PENDING setelah delay
  -> worker memeriksa status
  -> template reminder text dirender
  -> URL mentah membuka browser eksternal
~~~

Reminder tidak boleh dikirim bila status sudah PAID, EXPIRED, atau CANCELLED.

### 8.3 Invoice

~~~text
Order PAID dikonfirmasi
  -> invoice dipastikan tersedia
  -> notification job payment.paid.customer
  -> template text berisi invoice_url
  -> customer klik URL
  -> browser eksternal terbuka
  -> customer download PDF/PNG
~~~

## 9. Kompatibilitas dan fallback

Perilaku raw URL harus diuji, bukan diasumsikan sama pada semua versi WhatsApp.

Jika suatu versi/perangkat tetap membuka raw URL di browser internal:

1. Customer masih dapat salin URL dari pesan.
2. Customer dapat memilih “Buka dengan” dari menu perangkat bila tersedia.
3. Fase lanjutan dapat menambahkan endpoint file server atau native media.

Server-side PNG/PDF dan media native tetap menjadi opsi penguatan, tetapi tidak masuk scope P0 selama raw URL menyelesaikan masalah pada perangkat target.

## 10. Keamanan dan privasi

1. Jangan log nilai `public_token` atau `upload_token`.
2. Jangan memasukkan token ke event analytics.
3. Jangan menampilkan link customer lengkap pada activity log admin.
4. Gunakan URL yang dibangun server dari `NEXT_PUBLIC_APP_URL`.
5. Pastikan host URL sesuai domain ILJ Hub.
6. Hindari open redirect.
7. Jangan menerima URL arbitrary dari input customer untuk template transaksi.
8. Test-send menggunakan URL dummy yang tidak membuka data customer.
9. Dedupe tetap berdasarkan event dan order, bukan URL.

## 11. Telemetry

Event internal yang dibutuhkan:

- `notification.text_link.queued`
- `notification.text_link.sent`
- `notification.text_link.failed`
- `notification.text_link.delivered`

Metadata aman:

- `event_key`;
- `template_id`;
- `notification_job_id`;
- provider message ID;
- delivery status;
- correlation ID non-secret.

Jangan mencatat URL lengkap karena mengandung bearer token publik.

Keberhasilan klik/open-browser tidak dapat dipastikan hanya dari provider delivery. Verifikasi perilaku browser dilakukan melalui tes perangkat nyata.

## 12. Acceptance criteria

### 12.1 Konfigurasi pesan

1. Ketiga event customer menggunakan template bertipe `text`.
2. Tidak ada CTA URL/interaktif pada ketiga payload.
3. URL mentah terlihat pada baris tersendiri.
4. `preview_url` false pada rollout awal.
5. Copywriting tetap sama dengan template yang dikonfigurasi, selain kalimat CTA yang disesuaikan dari “tekan tombol” menjadi “buka link”.

### 12.2 QRIS

1. Link dari pesan text membuka browser eksternal pada perangkat target pengguna.
2. Link menuju `/pay/{public_token}/qris`.
3. Halaman menampilkan order yang benar.
4. QR dapat di-download dari browser eksternal.
5. QR expired tetap mengikuti status server.
6. Refresh tidak membuat order atau notifikasi baru.

### 12.3 Invoice

1. Link invoice dikirim setelah pembayaran PAID.
2. Link menuju `/pay/{public_token}`.
3. Invoice menampilkan data order yang benar.
4. PDF/PNG dapat di-download dari browser eksternal.
5. Invoice berstatus LUNAS hanya ketika PAID.

### 12.4 Delivery

1. `invoice.created.customer` terkirim satu kali.
2. Reminder hanya terkirim bila order masih PENDING.
3. `payment.paid.customer` terkirim satu kali.
4. Semua expected job berstatus `sent`.
5. Setiap pesan memiliki provider message ID.
6. Webhook/polling/reconciliation tidak menghasilkan duplikasi.

## 13. Matriks QA

| Platform | Tipe pesan | Hasil yang diharapkan |
| --- | --- | --- |
| Perangkat pengguna yang melaporkan masalah | `text` + raw URL | Browser eksternal |
| Android + WhatsApp stable | `text` + raw URL | Browser default/eksternal |
| Android + WhatsApp beta bila tersedia | `text` + raw URL | Dicatat aktualnya |
| iOS + WhatsApp stable | `text` + raw URL | Safari/default browser atau hasil aktual dicatat |
| WhatsApp Web/Desktop | `text` + raw URL | Browser desktop |

Skenario yang diuji:

- QRIS baru;
- reminder QRIS;
- invoice setelah PAID;
- klik langsung pada URL;
- klik link preview tidak diuji pada rollout awal karena preview dimatikan;
- copy-paste URL;
- QR PENDING/PAID/EXPIRED;
- retry dan reconciliation;
- pesan diterima dua nomor pengujian;
- download PNG QR;
- download PDF dan PNG invoice.

Gunakan paket tes yang sudah ada dan jangan menyembunyikan atau menghapusnya.

## 14. Test teknis dan release verification

### Unit/integration

- Renderer mengganti `{{payment_url}}`.
- Renderer mengganti `{{invoice_url}}`.
- Payload bertipe `text`.
- Payload tidak memiliki interactive CTA.
- URL HTTPS valid.
- Fallback template sama dengan perilaku template database.
- Dedupe key tidak berubah.
- Reminder dibatalkan jika order bukan PENDING.

### Release

1. `npx tsc --noEmit`
2. `npx next build`
3. Jalankan migration template.
4. Kirim QRIS paket tes.
5. Klik URL dari perangkat yang sebelumnya gagal.
6. Pastikan browser eksternal terbuka.
7. Download QR.
8. Selesaikan pembayaran tes.
9. Klik URL invoice dari pesan text.
10. Download PDF/PNG invoice.
11. Verifikasi live:
    - `payment_orders.status`;
    - `processed_at`;
    - `processing_error`;
    - `synced_to_posting`;
    - seluruh `notification_jobs`;
    - provider message ID.

## 15. Rollout

### Fase 1 — Test terkontrol

- Ubah ketiga fallback di kode.
- Siapkan migration tiga template produksi.
- Jalankan typecheck/build.
- Deploy.
- Terapkan migration.
- Uji dengan paket tes dan nomor pengguna/admin.

### Fase 2 — Verifikasi perilaku

- Bandingkan pesan `url_button` lama dengan pesan `text` baru.
- Catat browser yang terbuka.
- Pastikan download QR/invoice berhasil.
- Pastikan pesan tidak ganda.

### Fase 3 — Rollout penuh

- Pertahankan template `text` bila acceptance criteria lulus.
- Monitor delivery dan error notification minimal 24 jam.
- Jangan menghapus template lama sampai masa rollback selesai.

### Rollback

Jika raw URL tidak konsisten pada mayoritas perangkat:

- kembalikan `template_id`/type ke `url_button`;
- jangan mengubah payment order atau invoice;
- evaluasi server-side attachment atau native media sebagai fase lanjutan.

Rollback template tidak memerlukan perubahan token/order.

## 16. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| WhatsApp mengubah cara membuka raw URL | Uji versi target; template mudah di-rollback |
| Link preview membuka jalur berbeda | `preview_url: false` pada rollout awal |
| Placeholder URL tidak dirender | Test payload dan blok pengiriman jika masih mengandung `{{...}}` |
| Token terlihat di log | Redaksi URL/token dan larangan logging |
| Customer menerima pesan ganda | Pertahankan dedupe event + order |
| Copy template berubah | Edit minimal: ganti instruksi tombol menjadi instruksi link |
| Reminder terkirim setelah PAID | Worker memeriksa status sebelum kirim |
| Link text tidak clickable | URL HTTPS absolut, baris tersendiri, tanpa punctuation menempel |

## 17. Definition of Done

Perbaikan selesai bila:

1. Tiga template customer memakai `text` dan raw URL.
2. Perangkat pengguna membuka link ke browser eksternal.
3. QR dan invoice dapat di-download.
4. Isi pesan tetap sesuai Notification Center.
5. Semua expected notification job berstatus `sent`.
6. Tidak ada pesan duplikat.
7. Typecheck dan build production lulus.
8. Tes paket tes lulus.
9. Tidak ada token sensitif di log.

## 18. Rekomendasi final

Implementasi pertama cukup fokus pada perubahan:

~~~text
url_button -> text
button.url -> raw URL di body
preview_url -> false
~~~

Tidak perlu membangun redirect browser luar. Perilaku WhatsApp yang sudah dibuktikan pengguna dimanfaatkan langsung, dengan rollout terkontrol dan fallback yang mudah dikembalikan.
