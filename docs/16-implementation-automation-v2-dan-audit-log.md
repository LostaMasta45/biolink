# Implementasi Automation v2 dan Audit Log WhatsApp

Dokumen ini mencatat implementasi prioritas 1–6, upgrade log, overview, antrean pengiriman, serta prosedur pengujian dua nomor WhatsApp.

## Status implementasi

Pada 16 Juli 2026, implementasi kode selesai dan lolos:

- `npx tsc --noEmit`
- ESLint terarah untuk seluruh file yang diubah
- `npm run build` dengan 42 halaman berhasil dibangun

Tes pengiriman nyata juga berhasil pada 16 Juli 2026 sekitar 11:10 WIB:

```text
Bot (nomor berakhiran 6000) → Admin Utama (nomor berakhiran 6975)
KirimDev HTTP status: 200
Activity Log: api.message.send / success
Source: overview_test_bot_to_admin
Webhook Log: api.message.accepted / success
Latency: 399 ms
```

Phone ID dan nomor pengirim/penerima telah divalidasi berbeda sebelum pengiriman, sehingga tes tidak mengirim dari sebuah nomor ke nomor itu sendiri.

Database live masih harus menjalankan migration `supabase-migration-whatsapp-automation-v2.sql` sebelum kode v2 dipakai. Migration dibuat idempotent sehingga aman dijalankan ulang. Service-role key tidak mempunyai izin DDL dan tidak dapat menggantikan Supabase SQL Editor atau database access token.

## Ringkasan prioritas 1–6

### 1. Match type

Setiap rule mempunyai pilihan:

- `equals`: pesan harus sama persis setelah normalisasi.
- `starts_with`: pesan harus diawali keyword.
- `contains`: keyword boleh berada di dalam kalimat.

Jika beberapa rule cocok, engine memilih satu rule menggunakan urutan `equals`, `starts_with`, `contains`, nilai `priority` terbesar, lalu rule yang dibuat lebih dahulu. Default tetap `equals` karena paling aman untuk customer service.

### 2. Delay dan durable queue

Webhook tidak menjalankan `sleep`. Rule disimpan sebagai job pada tabel `auto_reply_jobs` dengan `scheduled_at`.

```text
Webhook → Match rule → Simpan job → Worker cron → KirimDev → Audit log
```

Delay rule dibatasi 0–30 detik. Worker tersedia pada:

```text
GET /api/cron/whatsapp-auto-reply
Authorization: Bearer CRON_SECRET
```

`vercel.json` menjalankan worker setiap menit. Tombol **Proses Antrean** pada Overview dapat dipakai untuk pemeriksaan manual. Delay nol langsung diproses oleh request webhook; delay lain diproses pada tick worker berikutnya.

### 3. Cooldown dan deduplikasi

- Cooldown disimpan per kombinasi customer dan rule.
- Job `queued`, `processing`, `retry`, atau `sent` ikut diperhitungkan.
- Event webhook diklaim sekali melalui `webhook_event_receipts`.
- Webhook duplikat menghasilkan `duplicate_ignored`, bukan pengiriman kedua.
- Pengiriman yang dilewati dicatat sebagai `skipped`, bukan `failed`.

### 4. Priority

Nilai priority dapat diatur dari -1000 sampai 1000. Priority dipakai setelah tingkat spesifik match type dibandingkan. Engine hanya menjalankan satu rule terbaik untuk satu pesan customer.

| Keyword | Match | Priority |
|---|---|---:|
| `komplain pembayaran` | equals | 100 |
| `pembayaran` | contains | 50 |
| `harga` | contains | 10 |

### 5. Jam kerja dan handover

Settings menyediakan toggle jam kerja, jam mulai/selesai, hari operasional, dan timezone. Rule dapat berjalan setiap saat, hanya jam kerja, atau hanya di luar jam kerja.

Rule handover membuat sesi pada `whatsapp_handover_sessions`. Setelah template handover dikirim, automation customer tersebut dihentikan selama durasi yang ditentukan. Default yang disarankan adalah 480 menit.

### 6. Test mode dan simulator

Test mode menggunakan allowlist nomor pada setiap rule. Customer di luar allowlist tidak menerima balasan dan aktivitasnya dicatat sebagai `auto_reply.skipped_test_mode`.

Simulator di Settings sekarang benar-benar `dry-run`: tidak memanggil API KirimDev, tidak mengirim WhatsApp, tidak membuat job, dan menampilkan keyword, template, serta delay yang akan dipilih. Simulator lama yang mengirim webhook palsu telah diganti karena dapat mengirim balasan nyata ke nomor simulasi.

## Upgrade audit log

Semua fungsi pengiriman KirimDev sekarang melewati satu request layer dan selalu mencatat nomor tujuan, Phone ID pengirim, tipe pesan, sumber, correlation/job ID, rule/template ID, HTTP status, latency, provider message ID/status, serta response atau error provider.

| Event | Makna |
|---|---|
| `api.message.send` | Setiap request pengiriman ke KirimDev |
| `api.message.status` | Status sent/delivered/read/failed dari webhook |
| `auto_reply.queued` | Job berhasil dibuat |
| `auto_reply.sent` | Worker berhasil mengirim template |
| `auto_reply.retry` | Gagal sementara dan dijadwalkan ulang |
| `auto_reply.failed` | Retry habis atau konfigurasi gagal |
| `auto_reply.skipped_cooldown` | Dibatasi anti-spam |
| `auto_reply.skipped_test_mode` | Nomor tidak masuk allowlist |
| `auto_reply.skipped_schedule` | Rule tidak aktif pada waktu tersebut |
| `auto_reply.skipped_handover` | Percakapan sedang ditangani manusia |

Webhook Monitor juga mencatat API outbound sebagai `api.message.accepted` atau `api.message.failed`. Payload audit dapat dibuka dari dashboard tanpa melihat console server.

Audit mencakup semua jalur pengiriman yang ditemukan di repository: auto reply, command WhatsApp, notifikasi invoice/sistem, konfirmasi upload poster, webhook pembayaran, halaman test WA lama, dan tes Overview Bot → Admin.

## Upgrade Overview

Overview menampilkan total/rule aktif, trigger hari ini, success rate request API, pesan API hari ini, antrean aktif, job gagal, handover aktif, aktivitas yang dilewati, kesehatan webhook, dan rute pengujian Bot → Admin Utama.

Quick Action baru:

- **Proses Antrean** menjalankan worker secara manual.
- **Tes Bot → Admin** mengirim satu pesan nyata setelah konfirmasi.

## Migration database

1. Buka Supabase Dashboard dan pilih proyek ILJ Hub.
2. Buka **SQL Editor**.
3. Salin seluruh isi `supabase-migration-whatsapp-automation-v2.sql`.
4. Klik **Run** satu kali dan pastikan tidak ada error.
5. Tambahkan environment berikut pada deployment:

```env
CRON_SECRET=random-secret-minimal-32-karakter
```

6. Restart server lokal atau deploy ulang.

Validasi schema:

```sql
SELECT match_type, delay_seconds, cooldown_seconds, priority,
       schedule_mode, handover_to_human, is_test_mode
FROM auto_reply
LIMIT 1;

SELECT COUNT(*) FROM auto_reply_jobs;
SELECT COUNT(*) FROM webhook_event_receipts;
SELECT COUNT(*) FROM whatsapp_handover_sessions;
```

## Peraturan pengujian dua nomor

Jangan memakai nomor yang sama sebagai pengirim dan penerima tes. Rute yang benar:

```text
Bot → Admin Utama
```

Rute tes Overview mengambil account kedua sebagai pengirim, account pertama sebagai penerima, menggunakan pesan teks, dan mencatat source `overview_test_bot_to_admin`.

## Tutorial tes setelah migration

### A. Tes tanpa mengirim WhatsApp

1. Buka **WhatsApp → Settings**.
2. Isi nomor simulasi yang masuk allowlist bila rule memakai test mode.
3. Isi keyword dan klik **Jalankan Dry-run**.
4. Pastikan hasil menunjukkan rule, template, dan delay yang benar.

### B. Tes match type

| Rule | Pesan tes | Hasil |
|---|---|---|
| equals `harga` | `HARGA` | cocok |
| starts_with `order` | `order paket feed` | cocok |
| contains `pricelist` | `boleh minta pricelist kak` | cocok |

Negative test `harga kak` terhadap rule equals harus tidak cocok.

### C. Tes delay dan queue

1. Atur delay 10 detik dan picu keyword dari nomor allowlist.
2. Activity Log harus memiliki `auto_reply.queued`.
3. Setelah `scheduled_at`, klik **Proses Antrean** atau tunggu cron.
4. Periksa `api.message.send` dan `auto_reply.sent`.

### D. Tes cooldown dan deduplikasi

1. Atur cooldown 60 detik lalu kirim keyword dua kali dengan cepat.
2. Pesan pertama harus queued/sent.
3. Pesan kedua harus tercatat `auto_reply.skipped_cooldown`.
4. Payload dengan event ID sama harus dijawab `duplicate_ignored`.

### E. Tes jam kerja dan handover

1. Aktifkan jam kerja di Settings.
2. Buat satu rule `business_hours` dan satu `outside_hours`.
3. Jalankan dry-run untuk memastikan hanya rule sesuai jadwal terpilih.
4. Picu keyword handover, lalu keyword lain dari customer yang sama.
5. Event kedua harus tercatat `auto_reply.skipped_handover`.

### F. Tes nyata Bot → Admin Utama

1. Pastikan dua account tampil di Overview.
2. Klik **Tes Bot → Admin** dan setujui konfirmasi tujuan.
3. Pastikan Admin Utama menerima pesan dari Bot.
4. Cari `api.message.send` dengan source `overview_test_bot_to_admin`.
5. Periksa `api.message.accepted` serta status delivered/read bila tersedia.

## Rollback darurat

Nonaktifkan seluruh rule Auto Reply, pertahankan log untuk audit, ubah job `queued/retry` menjadi `cancelled` melalui SQL bila benar-benar diperlukan, lakukan dry-run, lalu aktifkan satu rule test sebelum membuka automation untuk customer.
