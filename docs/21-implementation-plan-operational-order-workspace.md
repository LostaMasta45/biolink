# Implementation Plan — Operational Order Workspace & WhatsApp Admin Bot

Dokumen ini adalah rencana eksekusi teknis untuk PRD [20-prd-operational-order-workspace.md](./20-prd-operational-order-workspace.md). Dokumen ini belum mengubah perilaku production dan dapat dijadikan checklist kerja implementasi.

Status: siap dieksekusi  
Tanggal: 17 Juli 2026  
Estimasi: 4 fase implementasi, masing-masing dapat dirilis mandiri

## 0. Prinsip dan batasan wajib

1. Inbox hanya untuk pemasang lowongan yang sedang aktif; jangan dikembangkan menjadi CRM chat jangka panjang.
2. Customer selalu menerima WhatsApp dari **Admin Utama**, bukan Bot.
3. Bot hanya menerima command dari nomor Admin Utama dan hanya mengirim notifikasi internal ke nomor Admin Utama.
4. Semua aksi kirim pesan memakai Notification Center / service notifikasi terpusat. Jangan menambah `sendTextMessage()` langsung di business service baru.
5. Tidak boleh memutus Invoice, Pembayaran, Antrian Posting, QRIS, atau Telegram lama pada fase pertama.
6. Semua perubahan status harus idempotent, memiliki actor, timestamp, dan jejak audit.
7. Semua data baru menggunakan service-role di backend; browser hanya memakai API yang telah terautentikasi.

## 1. Pemetaan sistem sebelum coding

Lakukan audit singkat berikut dan tulis hasilnya di pull request/commit pertama.

| Area sekarang | Lokasi utama | Keputusan implementasi |
| --- | --- | --- |
| Posting/antrian | `src/app/admin/antri/page.tsx`, `src/lib/posting-service.ts` | Menjadi sumber jadwal dan status publikasi. |
| Invoice | `src/app/admin/invoice/page.tsx`, `src/lib/invoice-service.ts` | Menjadi sumber nominal dan invoice customer. |
| Pembayaran | `src/app/admin/pembayaran`, `src/app/api/payment/*` | Menjadi sumber status pembayaran. |
| Poster/data | `src/app/api/payment/upload-poster/route.ts` | Menjadi sinyal asset tersedia. |
| Notifikasi | `src/services/whatsapp-notification-service.ts` | Satu-satunya jalur pesan baru. |
| WhatsApp Admin Bot | `src/lib/whatsapp/command-processor.ts`, `src/lib/whatsapp/commands/*` | Menjadi remote control, tidak menyimpan business logic duplikat. |
| Telegram | `src/lib/telegram-service.ts` dan beberapa service/route | Tetap fallback hingga fase 4 selesai. |

Audit wajib menjawab:

- Nama tabel dan primary key aktual untuk posting, payment order, invoice, invoice item, dan upload poster.
- Relasi yang sudah tersedia antara order pembayaran, invoice, dan posting.
- Status yang benar-benar dipakai di production beserta variasi huruf besar/kecil.
- Apakah satu pemasangan dapat menghasilkan lebih dari satu posting atau lebih dari satu invoice.
- Kolom nomor customer yang paling stabil untuk matching (`628…`, `08…`, atau format lain).

Jangan membuat asumsi migration sebelum jawaban tersebut diverifikasi pada schema Supabase.

## 2. Fase 1 — Read model Order Workspace dan Dashboard Command Center

### Tujuan rilis

Admin dapat melihat semua pemasangan dalam satu tempat dan mengetahui tindakan berikutnya tanpa mengubah alur pembayaran atau posting lama.

### 2.1 Migration database: read model minimal

Buat file `supabase-migration-placement-orders.sql` dengan pola aman dijalankan ulang.

Tabel baru `placement_orders`:

```sql
id uuid primary key default gen_random_uuid(),
order_code text unique not null,
source_payment_order_id text null,
invoice_id uuid null,
posting_id uuid null,
customer_name text null,
customer_phone text null,
company_name text null,
package_id bigint null,
package_name text null,
total_amount numeric not null default 0,
status text not null default 'draft',
owner_user_id uuid null,
due_at timestamptz null,
scheduled_at timestamptz null,
posted_at timestamptz null,
blocked_reason text null,
metadata jsonb not null default '{}'::jsonb,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Tabel baru `placement_order_events`:

```sql
id uuid primary key default gen_random_uuid(),
placement_order_id uuid not null references placement_orders(id) on delete cascade,
event_type text not null,
from_status text null,
to_status text null,
actor_type text not null, -- user | bot | system | webhook
actor_id text null,
summary text not null,
metadata jsonb not null default '{}'::jsonb,
idempotency_key text unique null,
created_at timestamptz not null default now()
```

Tambahkan index:

- `placement_orders(status, due_at)`
- `placement_orders(customer_phone)`
- `placement_orders(invoice_id)`
- `placement_orders(posting_id)`
- `placement_order_events(placement_order_id, created_at desc)`

Tambahkan RLS yang mengikuti pola tabel admin yang ada. Browser tidak boleh memperoleh akses langsung bila tabel lain memakai service-role API.

### 2.2 Status model dan transition guard

Buat `src/lib/placement-order/status.ts`:

```ts
export type PlacementOrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid_needs_assets"
  | "ready_to_schedule"
  | "scheduled"
  | "posted"
  | "blocked"
  | "cancelled";
```

Buat `canTransitionPlacementOrder(from, to, context)` yang memvalidasi:

- `awaiting_payment` → `paid_needs_assets` hanya bila pembayaran confirmed.
- `paid_needs_assets` → `ready_to_schedule` hanya bila asset/data wajib lengkap.
- `ready_to_schedule` → `scheduled` hanya bila `scheduled_at` ada.
- `scheduled` → `posted` hanya bila posting lama menyatakan berhasil atau admin memakai aksi manual beralasan.
- Aksi `blocked` dapat dilakukan dari status aktif, tetapi wajib memiliki `blocked_reason`.
- `cancelled` tidak boleh kembali aktif tanpa action eksplisit `reopen` dan audit.

Jangan mempercayai status dari frontend; seluruh guard berjalan di service backend.

### 2.3 Service backend

Buat `src/services/placement-order-service.ts` dengan fungsi berikut:

- `listPlacementOrders(filters)`
- `getPlacementOrder(id)`
- `getPlacementOrderByReference({ invoiceId, postingId, paymentOrderId })`
- `createPlacementOrder(input, actor)`
- `updatePlacementOrder(id, patch, actor, idempotencyKey)`
- `transitionPlacementOrder(id, nextStatus, context, actor, idempotencyKey)`
- `appendPlacementOrderEvent(orderId, event)`
- `getPlacementDashboardSummary(now)`

Aturan service:

- Semua write memakai transaksi RPC Supabase bila memungkinkan. Jika belum ada RPC, gunakan insert/update berurutan yang dapat diulang secara aman dengan `idempotency_key`.
- Normalisasi nomor telepon menjadi format `628…` hanya di satu util bersama.
- `order_code` dibuat di backend, bukan dari browser.
- Projection dari data lama harus dapat dipanggil ulang tanpa menghasilkan order ganda.

### 2.4 Backfill awal

Buat endpoint admin/internal atau script satu kali yang:

1. Membaca posting dan order/invoice yang relevan.
2. Menentukan referensi paling kuat: `payment_order_id` → `invoice_id` → nomor customer + tanggal + nominal sebagai fallback yang perlu ditandai `needs_review`.
3. Membuat `placement_orders` dengan `idempotency_key` stabil per sumber.
4. Menulis event `projection.imported`.
5. Mencetak ringkasan: dibuat, dilewati, ambigu, gagal.

Tidak boleh menjalankan backfill otomatis pada request user biasa. Jalankan manual dari endpoint admin terproteksi, lalu dokumentasikan hasilnya.

### 2.5 API routes

Tambahkan route dengan pola autentikasi `/api/admin/whatsapp/*` yang sudah ada:

| Route | Method | Fungsi |
| --- | --- | --- |
| `/api/admin/placements` | GET | Daftar order, filter status/owner/search/cursor. |
| `/api/admin/placements` | POST | Buat draft order baru. |
| `/api/admin/placements/[id]` | GET | Detail, checklist, referensi, timeline. |
| `/api/admin/placements/[id]` | PATCH | Ubah data yang aman. |
| `/api/admin/placements/[id]/transition` | POST | Transisi status dengan idempotency key. |
| `/api/admin/placements/[id]/events` | GET | Timeline dengan pagination. |
| `/api/admin/placements/summary` | GET | Angka command center. |
| `/api/admin/placements/backfill` | POST | Admin-only, tidak tampil sebagai tombol biasa. |

Setiap response error minimal memiliki `error`, `code`, `correlationId`, dan alasan validasi yang dapat dibaca UI.

### 2.6 Halaman dan komponen UI

Tambahkan:

- `src/app/admin/pemasangan/page.tsx`
- `src/components/placement/placement-workspace.tsx`
- `src/components/placement/placement-summary.tsx`
- `src/components/placement/placement-list.tsx`
- `src/components/placement/placement-detail-drawer.tsx`
- `src/components/placement/placement-timeline.tsx`

Desain desktop:

- Baris summary actionable di atas.
- Filter status/owner/tanggal/search dalam satu toolbar.
- Tabel/list di bawah dengan next action dominan, bukan hanya badge status.
- Detail ditampilkan drawer kanan agar daftar tetap terlihat.

Desain mobile:

- Summary berupa horizontal scroll yang aman, tanpa card keluar layar.
- Filter berada dalam sheet/dropdown.
- List berbentuk item ringkas; tap membuka halaman/drawer penuh.
- Tombol action menggunakan label, bukan icon tanpa konteks.

Tambahkan menu **Pemasangan** di sidebar desktop dan mobile di bawah kelompok Operasional, sebelum Antrian Posting.

### 2.7 Dashboard utama

Jangan menghapus statistik keuangan; ubah urutan prioritas:

1. Tambahkan `OperationalAttention` dari `/api/admin/placements/summary`.
2. Tampilkan: perlu tindakan, pembayaran pending, lunas belum lengkap, jadwal hari ini, overdue, dan error integrasi.
3. Setiap kartu membuka `/admin/pemasangan?filter=…`.
4. Pindahkan grafik omzet, paket, dan pelanggan berulang ke blok “Analitik” di bawah daftar kerja hari ini.
5. Tambahkan tombol `Pemasangan baru`, `Invoice baru`, `Upload poster`, dan `Buka jadwal`.

### 2.8 Acceptance criteria fase 1

- Admin dapat melihat order dari data lama tanpa duplikasi setelah backfill dijalankan dua kali.
- Satu order dapat dibuka dari Invoice, Pembayaran, Antrian Posting, atau Pemasangan.
- Dashboard menunjukkan angka actionable yang sama dengan daftar terfilter.
- Detail order memiliki timeline minimal untuk creation/projection dan perubahan status.
- Desktop 1280px dan mobile 360px tidak mengalami overflow horizontal.
- Unit test transition guard dan test API route lulus.

## 3. Fase 2 — Checklist asset, aksi customer, dan integrasi lifecycle

### Tujuan rilis

Order dapat berjalan dari invoice dibayar sampai siap dijadwalkan melalui checklist yang konsisten.

### 3.1 Migration asset

Tambahkan `placement_order_assets`:

```sql
id uuid primary key default gen_random_uuid(),
placement_order_id uuid not null references placement_orders(id) on delete cascade,
asset_type text not null, -- poster | logo | brief | job_description | application_link
label text null,
url text null,
is_required boolean not null default false,
is_valid boolean not null default false,
metadata jsonb not null default '{}'::jsonb,
uploaded_by text null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now(),
unique (placement_order_id, asset_type, url)
```

Tambahkan konfigurasi wajib berdasarkan paket di `metadata` package atau tabel konfigurasi baru. Jangan hardcode seluruh aturan di komponen React.

### 3.2 Integrasi event domain

Di titik yang sudah ada, panggil service placement setelah write utama sukses:

| Sumber | Event | Efek placement |
| --- | --- | --- |
| Invoice dibuat | `invoice.created` | Link invoice; status ke `awaiting_payment`. |
| Payment webhook verified | `payment.paid` | Status ke `paid_needs_assets`, event immutable. |
| Upload poster sukses | `asset.poster_uploaded` | Upsert asset; re-evaluasi checklist. |
| Posting dijadwalkan | `posting.scheduled` | Simpan `posting_id`, `scheduled_at`, status `scheduled`. |
| Posting selesai | `posting.published` | Status `posted`, simpan waktu/link hasil. |

Gunakan handler kecil per integrasi, misalnya `src/services/placement-order-events.ts`. Jangan memindahkan business logic posting/payment ke WhatsApp.

### 3.3 Checklist dan next action engine

Buat `evaluatePlacementReadiness(order)` yang mengembalikan:

- `missing`: daftar syarat belum lengkap.
- `warnings`: informasi tidak memblokir.
- `nextAction`: satu aksi prioritas.
- `eligibleForStatus`: status tujuan yang diizinkan.

Contoh:

| Kondisi | Next action |
| --- | --- |
| Invoice belum paid | `send_payment_reminder` |
| Paid + poster tidak ada | `request_poster` |
| Poster ada + jadwal kosong | `schedule_posting` |
| Jadwal lewat + belum posted | `mark_or_investigate_posting` |

### 3.4 Aksi customer melalui Notification Center

Tambahkan event template baru ke Notification Center:

- `placement.payment_reminder.customer`
- `placement.assets_requested.customer`
- `placement.ready_to_schedule.customer`
- `placement.scheduled.customer`
- `placement.published.customer`

Setiap action UI melakukan:

1. Validasi order/customer/window.
2. Emit event dengan `dedupeId` stabil, contoh `placement:{orderId}:request-assets:{assetRevision}`.
3. Menyimpan event order `notification.requested`.
4. Menerima status dari notification job/webhook dan menulis `notification.sent` atau `notification.failed` ke timeline.

Tampilkan error provider secara jelas; jangan menandai customer “sudah diberi tahu” sebelum job berhasil diterima provider.

### 3.5 Pemasangan ulang

Tambahkan endpoint `POST /api/admin/placements/[id]/duplicate`:

- Hanya menyalin data perusahaan dan preferensi paket yang aman.
- Tidak menyalin invoice, payment, timeline, asset, atau jadwal lama.
- Menghasilkan draft baru dengan relasi `metadata.duplicated_from`.
- Tampilkan confirmation UI sebelum order dibuat.

### 3.6 Acceptance criteria fase 2

- Payment webhook yang diterima dua kali tidak menggandakan event/order.
- Upload poster memutakhirkan order yang benar dan checklist berubah otomatis.
- Order tidak dapat dijadwalkan bila syarat wajib belum lengkap.
- Reminder memakai dedupe dan seluruh hasilnya terlihat di timeline/log.
- Duplicate order tidak membawa invoice/pembayaran lama.

## 4. Fase 3 — WhatsApp Admin Bot sebagai remote control

### Tujuan rilis

Admin dapat mengambil tindakan penting dari chat Bot tanpa membuat jalur bisnis kedua.

### 4.1 Struktur command

Tambahkan handler baru berbasis service Placement, bukan query Supabase langsung dari command handler:

| Command / tombol | Handler | Keluaran |
| --- | --- | --- |
| `!buat` | `placement-create` | Form bertahap atau link form dashboard. |
| `!hariini` | `placement-today` | Ringkasan tindakan dan list. |
| `!siap` | `placement-ready` | Order yang siap jadwal. |
| `!jadwal` | `placement-schedule` | Jadwal posting hari ini. |
| `!cek <id>` | perluas handler existing | Detail order/invoice/posting. |
| `!tagih <id>` | perluas handler existing | Emit reminder Notification Center. |
| `!gagal` | perluas handler existing | Error order/notifikasi terbaru. |

Pertahankan alias lama yang sudah digunakan. Jangan mengganti `!buat_invoice` secara tiba-tiba; jadikan ia mode kompatibilitas atau arahkan bertahap ke `!buat`.

### 4.2 Menu interaktif

Perbarui `!menu` menjadi list berkelompok:

```text
Pemasangan
  • Pemasangan baru
  • Pekerjaan hari ini
  • Lunas belum lengkap
  • Jadwal hari ini

Keuangan
  • Buat / cek invoice
  • Tagihan pending

Sistem
  • Status notifikasi
  • Pengiriman gagal
```

Button/list payload harus pendek, stabil, dan hanya mewakili action yang dikenal server. Jangan menaruh data customer atau harga sebagai payload button.

### 4.3 Session state machine yang aman

Tabel `bot_sessions` sudah ada. Tambahkan aturan:

- Satu sesi aktif per nomor admin + jenis flow.
- Session memiliki `expires_at` dan maksimal 30 menit.
- Semua update memakai version/updated-at untuk mencegah webhook dobel melompati step.
- `!cancel` selalu menutup sesi dan membuat audit event.
- Sebelum membuat order/invoice, tampilkan ringkasan dan minta konfirmasi `YA`.
- Saat konfirmasi, kirim `idempotency_key` yang sama bila webhook diulang.

Untuk form yang panjang, Bot mengirim tombol **Buka form dashboard** ke halaman admin yang sudah login. Bot sebaiknya tidak dipaksa menjadi form penuh untuk seluruh detail lowongan.

### 4.4 Keamanan

- Periksa pengirim Admin Utama **dan** tujuan phone ID Bot pada setiap command, seperti pola webhook sekarang.
- Log `admin_bot.command.received`, `completed`, `skipped`, dan `failed` wajib memiliki `placement_order_id` bila tersedia.
- Jangan pernah mengirim nomor customer, nominal, atau link internal ke nomor yang bukan Admin Utama.
- Deep link dashboard tetap memerlukan session admin; tidak memakai token permanen dalam pesan WhatsApp.

### 4.5 Acceptance criteria fase 3

- `!menu` dapat dijalankan dari Admin Utama dan ditolak dari nomor lain.
- Command hari ini menampilkan data yang sama dengan dashboard command center.
- Pembuatan order dari Bot tidak menciptakan order ganda ketika webhook diulang.
- Reminder dari Bot tetap dikirim Admin Utama ke customer via Notification Center.
- Semua command memiliki audit log dan link/korelasi ke order bila relevan.

## 5. Fase 4 — Konsolidasi Telegram secara aman

### Tujuan rilis

Tidak ada business service yang mengirim Telegram atau WhatsApp secara langsung; semuanya memancarkan event domain ke satu dispatcher.

### 5.1 Buat notification dispatcher

Buat `src/services/operational-notification-dispatcher.ts`:

```ts
emitOperationalEvent({
  eventKey,
  entityType, // placement_order | invoice | payment | posting
  entityId,
  correlationId,
  payload,
});
```

Dispatcher:

1. Menulis event/audit terlebih dahulu.
2. Memanggil Notification Center untuk WhatsApp jika rule aktif.
3. Memanggil adapter Telegram hanya jika fallback/config mengizinkan.
4. Menggunakan dedupe key yang sama lintas channel, tetapi menyimpan delivery per channel.
5. Tidak melempar error yang menggagalkan payment/posting utama hanya karena notifikasi gagal.

### 5.2 Adapter Telegram

Biarkan `src/lib/telegram-service.ts` sebagai adapter semata. Panggilan dari:

- `finance-service.ts`
- `invoice-service.ts`
- `posting-service.ts`
- payment webhook
- upload poster route

diganti satu per satu dengan `emitOperationalEvent()`. Setiap penggantian harus memiliki test regresi yang membuktikan event WhatsApp dan fallback Telegram tidak terkirim dua kali.

### 5.3 Konfigurasi channel dan observability

Tambahkan konfigurasi per event:

```text
channel: whatsapp_admin | whatsapp_customer | telegram_fallback
enabled: boolean
fallback_after_attempts: number
dedupe_window_seconds: number
```

Tambahkan dashboard/ringkasan delivery:

- event diterima;
- WhatsApp queued/sent/delivered/failed;
- Telegram sent/failed;
- alasan fallback dipakai;
- correlation ID.

### 5.4 Rencana transisi production

1. Minggu 1–2: dual delivery hanya untuk event internal non-kritis, bandingkan log.
2. Minggu 3–4: WhatsApp menjadi default, Telegram fallback jika WhatsApp job gagal setelah retry yang disepakati.
3. Setelah 30 hari: hapus pemanggilan Telegram langsung dan pertahankan adapter sebagai opsi konfigurasi.

Tidak ada penghapusan token Telegram atau route lama sebelum observability dan fallback terbukti stabil.

### 5.5 Acceptance criteria fase 4

- Satu payment event menghasilkan satu correlation ID dan maksimal satu delivery per channel dalam dedupe window.
- Kegagalan WhatsApp dapat terlihat dan fallback Telegram memiliki alasan tercatat.
- Tidak ada lagi import `telegram-service` langsung pada business service inti setelah migrasi selesai.
- Payment/posting tetap berhasil ketika kedua channel notifikasi gagal.

## 6. Test plan lintas fase

### Unit tests

- Normalisasi nomor telepon.
- Mapping data lama ke status placement.
- Transition guard setiap status valid/tidak valid.
- Dedupe/idempotency event.
- Readiness checklist berdasarkan paket.
- Payload Notification Center dan Bot command parser.

### Integration tests

- Create order → invoice → payment paid → asset upload → schedule → posted.
- Payment webhook dikirim dua kali.
- Upload poster dikirim dua kali.
- Notification gagal, retry, lalu delivered webhook diterima.
- Command Bot dari admin valid dan dari nomor lain ditolak.
- Telegram fallback hanya terjadi sesuai konfigurasi.

### UI regression checklist

- Desktop: 1280px dan 1440px.
- Mobile: 360px dan 390px; bottom nav tidak menutup action penting.
- Dark mode dan light mode.
- Loading, empty state, error state, dan list >100 order.
- Tidak ada card, table, drawer, dropdown, atau dialog yang overflow horizontal.

### Manual production checklist

1. Jalankan migration di Supabase SQL Editor dan catat timestamp.
2. Deploy staging/preview.
3. Jalankan backfill pada data kecil terlebih dahulu.
4. Cocokkan jumlah order result dengan Invoice/Antrian contoh.
5. Jalankan satu order test end-to-end menggunakan nomor test.
6. Periksa Activity Logs, webhook logs, notification jobs, dan status provider.
7. Baru aktifkan feature flag untuk semua admin.

## 7. Feature flag dan rollback

Tambahkan setting admin atau environment flag:

- `PLACEMENT_WORKSPACE_ENABLED`
- `PLACEMENT_BACKFILL_ENABLED`
- `WHATSAPP_ADMIN_BOT_PLACEMENT_ENABLED`
- `OPERATIONAL_NOTIFICATION_DISPATCHER_ENABLED`
- `TELEGRAM_FALLBACK_ENABLED`

Aturan rollback:

- Menonaktifkan UI/command baru tidak menghapus `placement_orders`.
- Event legacy tetap berjalan selama dispatcher belum diaktifkan penuh.
- Tidak ada migration destructive pada fase 1–4.
- Bila transition/notification error, order ditandai `blocked` dengan alasan dan admin diberi alert, bukan status diam-diam.

## 8. Urutan kerja besok

1. Baca dan verifikasi schema actual (bagian 1).
2. Tentukan relasi canonical antara posting, invoice, dan payment order.
3. Tulis migration `placement_orders` dan `placement_order_events`.
4. Implementasikan status guard + service + test unit sebelum UI.
5. Implementasikan API summary/list/detail dan test route.
6. Buat halaman Pemasangan responsive dan hubungkan menu.
7. Tambahkan kartu actionable ke Dashboard Admin.
8. Jalankan backfill dry run, review data ambigu, baru tulis data.
9. Lakukan QA Fase 1, push, lalu deploy.

Fase 2–4 tidak dikerjakan sebelum Fase 1 memiliki data projection yang konsisten dan dashboard dapat dipercaya.

## 9. Definition of done keseluruhan

Produk dianggap selesai bila:

- Admin dapat mengelola satu pemasangan dari request hingga posted melalui satu detail order.
- Dashboard memberi tahu tindakan berikutnya, bukan hanya angka ringkasan.
- Bot WhatsApp dapat melakukan tindakan operasional aman dengan audit lengkap.
- Pesan customer tetap dari Admin Utama dan mengikuti aturan provider.
- Telegram tidak lagi memiliki business logic tersebar dan hanya berperan sesuai konfigurasi fallback.
- Semua status, pengiriman, error, retry, dan webhook dapat ditelusuri dari satu correlation/order ID.
