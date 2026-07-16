# Notification Center dan Admin Bot

Tanggal implementasi: 16 Juli 2026

## Hasil akhir

Notifikasi WhatsApp tidak lagi bergantung pada copywriting yang tersebar di route pembayaran, invoice, poster, dan command. Semua jalur utama mengirim event ke `whatsapp-notification-service.ts`, lalu service menentukan rule, Pesan Tersimpan, pengirim, penerima, delay, retry, deduplikasi, dan log.

Keputusan operasional proyek ini:

- Customer selalu memulai chat ke nomor Admin Utama.
- Pesan customer menggunakan pesan free-form/Pesan Tersimpan, bukan Meta Template.
- Pesan otomatis untuk customer dikirim oleh Admin Utama. Khusus `!buat_invoice`, Bot mengembalikan teks invoice agar Admin Utama dapat meneruskannya sendiri, seperti alur lama.
- Notifikasi internal dan jawaban command selalu dikirim Bot ke Admin Utama.
- Bot hanya menerima command dari Admin Utama. Pesan customer ke Bot diabaikan.

## Aktivasi database wajib

Kode memiliki fallback copy agar payment/invoice/poster tidak langsung rusak sebelum migration. Namun menu dashboard Notification Center dan Bot Commands baru aktif setelah migration dijalankan.

Urutan di Supabase SQL Editor:

1. Pastikan `supabase-migration-whatsapp-manager.sql` sudah dijalankan.
2. Pastikan `supabase-migration-whatsapp-template-v3.sql` sudah dijalankan.
3. Jalankan seluruh isi `supabase-migration-whatsapp-notification-center.sql`.
4. Migration aman dijalankan ulang dan tidak menggandakan seed berdasarkan nama/event/command.

Service-role key tidak mempunyai hak DDL. Karena repo tidak memiliki database URL, Supabase access token, `psql`, atau Supabase CLI, migration tidak dapat dijalankan otomatis dari mesin pengembangan ini.

## Menu dashboard

### Notification Center

Halaman `/admin/whatsapp/notifications` digunakan untuk:

- memilih event;
- memilih Pesan Tersimpan;
- memilih penerima;
- memastikan pengirim Admin Utama atau Bot;
- mengatur delay 0–86.400 detik;
- mengatur retry 1–10 kali;
- mengatur dedupe window;
- mengisi default variable JSON;
- melihat antrean, terkirim, dan gagal;
- memproses antrean secara manual;
- mengirim tes aman Bot ke Admin Utama.

### Bot Commands

Halaman `/admin/whatsapp/commands` mengatur:

- command aktif/nonaktif;
- tampil/sembunyi pada `!menu`;
- deskripsi dan usage;
- kategori dan urutan;
- alias command.

Handler tidak dapat dibuat sembarang dari dashboard. Handler tetap harus tersedia di kode untuk mencegah command menunjuk fungsi yang tidak ada.

## Event bawaan

| Event | Pengirim | Penerima | Variabel utama |
|---|---|---|---|
| `payment.paid.customer` | Admin Utama | Customer | `customer_name`, `package_name`, `amount`, `order_id` |
| `payment.paid.admin` | Bot | Admin Utama | `customer_name`, `company_name`, `package_name`, `amount`, `order_id` |
| `invoice.created.admin` | Bot | Admin Utama | `invoice_number`, `customer_name`, `amount`, `invoice_url` |
| `invoice.created.customer` | Admin Utama | Customer | `customer_name`, `package_name`, `amount`, `payment_url` |
| `invoice.reminder.customer` | Admin Utama | Customer | `customer_name`, `package_name`, `amount`, `payment_url` |
| `poster.received.customer` | Admin Utama | Customer | `customer_name`, `company_name`, `package_name`, `poster_count` |

Variabel ditulis dalam Pesan Tersimpan seperti `{{customer_name}}`. Nilai event mengalahkan `variable_defaults` rule.

## Alur antrean dan retry

1. Endpoint memanggil `emitNotification()`.
2. Rule aktif dibaca berdasarkan `event_key`.
3. Sistem menolak pengirim dan penerima dengan nomor yang sama.
4. Job disimpan dengan `dedupe_key` unik.
5. Delay nol diproses langsung; delay lain diproses cron setiap menit.
6. KirimDev API mencatat `api.message.send`.
7. Webhook `message.status` memperbarui status provider.
8. Job gagal masuk retry eksponensial sampai `max_attempts`.

Cron yang sebelumnya memproses Auto Reply sekarang memproses kedua antrean: Auto Reply dan Notification Center.

## Keamanan webhook

Webhook hanya memproses payload dengan `X-Kirim-Signature` HMAC-SHA256 yang valid dan berusia maksimal lima menit. Simpan signing secret subscription di `KIRIMDEV_WEBHOOK_SECRET` (atau daftar secret rotasi dipisahkan koma pada `KIRIMDEV_WEBHOOK_SECRETS`). Payload tanpa signature valid dicatat sebagai `webhook.invalid_signature` dan ditolak sebelum dapat memicu command atau automation.

## Command Admin Bot

Command yang muncul di menu bawaan:

- `!menu` atau `!help`: menu list interaktif.
- `!rekap` atau `!rekapan`: rekap hari ini.
- `!cek INV-123`: cek order.
- `!tagihan`: daftar tagihan pending.
- `!tagih INV-123`: kirim reminder dari Admin Utama ke customer.
- `!buat_invoice` atau `!invoice`: form invoice interaktif.
- `!klien 628xxx`: histori customer.
- `!template list`: daftar Pesan Tersimpan.
- `!template kirim ID 628xxx`: kirim Pesan Tersimpan dari Admin Utama.
- `!notif status`: status Notification Center.
- `!gagal`: lima pengiriman gagal terbaru.
- `!cancel`: membatalkan sesi, disembunyikan dari menu utama.

`!inv_lowongan` dan `!inv_umum` adalah handler tombol internal dan tidak ditampilkan di `!menu`. `!stats` lama tidak disertakan karena sebelumnya hanya menghasilkan angka nol placeholder.

Setiap command meninggalkan jejak `admin_bot.command.received`, lalu `admin_bot.command.completed`, `admin_bot.command.skipped`, atau `admin_bot.command.failed` pada Activity Logs. Semua kiriman Bot/API juga tercatat sebagai `api.message.send` beserta tipe pesan, HTTP status, ID pesan KirimDev, dan respons provider. Status lanjutan `sent`, `delivered`, `read`, atau `failed` dicatat ketika webhook `message.status` diterima.

## Tutorial pengujian

### A. Tes konfigurasi rule

1. Buka Notification Center.
2. Edit satu rule dan pilih Pesan Tersimpan.
3. Klik ikon Play.
4. Konfirmasi pengiriman nyata.
5. Pastikan pesan diterima Admin Utama dari Bot.
6. Periksa Activity & API Logs: harus ada `api.message.send` dan `notification.sent`.

Tes rule sengaja tidak mengirim ke customer agar aman.

### B. Tes command

1. Dari WhatsApp Admin Utama, buka chat nomor Bot.
2. Kirim `!menu`.
3. Pastikan Bot membalas dengan interactive list.
4. Pilih `!rekap` atau kirim `!rekapan`.
5. Buka Activity Logs; pastikan ada `admin_bot.command.received`, `api.message.send`, dan `admin_bot.command.completed`.
6. Kirim command yang sama dari nomor lain; Bot tidak boleh menjalankannya.
7. Kirim command Admin Utama ke nomor Admin Utama; webhook harus mencatat `admin_command.wrong_account` dan tidak menjalankan command.

### C. Tes payment

1. Buat order test memakai nomor customer yang sudah chat ke Admin Utama.
2. Jalankan pembayaran sampai webhook berstatus `PAID`.
3. Customer harus menerima `payment.paid.customer` dari Admin Utama.
4. Admin Utama harus menerima `payment.paid.admin` dari Bot.
5. Payment webhook yang sama tidak boleh membuat kiriman ganda.

### D. Tes invoice dan reminder

1. Dari Admin Utama ke Bot, kirim `!buat_invoice`.
2. Selesaikan form.
3. Bot mengembalikan teks invoice yang siap diteruskan. Forward teks tersebut secara manual dari Admin Utama ke customer (alur `!buat_invoice` tidak diubah menjadi pengiriman otomatis).
4. Jalankan `!tagih ORDER_ID`.
5. Customer menerima reminder dari Admin Utama.
6. Jalankan lagi dalam dedupe window; pengiriman duplikat harus dilewati.

### E. Tes poster

1. Upload poster dari halaman payment.
2. Pastikan posting queue berubah menjadi `queued`.
3. Customer menerima `poster.received.customer` dari Admin Utama.
4. Cek log menggunakan `order_id` sebagai correlation/dedupe identifier.

## Catatan risiko free-form

Keputusan proyek adalah tidak memakai Meta Template karena customer selalu chat terlebih dahulu. Tetap perhatikan bahwa sesi free-form ditentukan oleh pesan masuk terakhir, bukan fakta bahwa customer pernah chat. Bila pesan terakhir sudah melewati batas layanan Meta, provider dapat menolak kiriman. Sistem akan mencatat error lengkap di Notification Center dan Activity Logs; tidak ada fallback diam-diam ke template.

## Troubleshooting

| Gejala | Pemeriksaan |
|---|---|
| Halaman Notification Center error tabel tidak ditemukan | Jalankan migration Notification Center |
| Pesan customer terkirim dari Bot | Periksa `sender_role`; event customer harus `admin` |
| Admin tidak menerima notif internal | Pastikan akun Bot dan nomor Admin Utama tersimpan di Settings |
| Command tidak membalas | Pastikan pengirim Admin Utama dan tujuan nomor Bot |
| `!menu` menampilkan command internal | Pastikan `show_in_menu=false` pada handler internal |
| Pesan tertunda tidak terkirim | Periksa cron, `CRON_SECRET`, dan tombol Proses Antrean |
| Pesan terkirim dua kali | Gunakan `dedupeId` yang stabil, misalnya `order_id` |
| KirimDev menerima request tetapi delivery gagal | Periksa event `api.message.status` dan error provider |
