# Implementation Walkthrough — WhatsApp Automation Manager

Dokumen ini menjelaskan hasil implementasi `wa.md`, cara menyiapkannya, dan alur penggunaan admin.

## Status Implementasi

Delapan modul PRD tersedia pada `/admin/whatsapp`:

| Modul | Route | Fungsi |
| --- | --- | --- |
| Overview | `/admin/whatsapp` | Monitoring API, webhook, jumlah konfigurasi, trigger harian, dan success rate |
| Flow Builder | `/admin/whatsapp/flow-builder` | Menyimpan customer journey dan konfigurasi node |
| Templates | `/admin/whatsapp/templates` | CRUD template dengan form dinamis dan preview |
| Automation | `/admin/whatsapp/automation` | CRUD rule Trigger → Condition → Action |
| Auto Reply | `/admin/whatsapp/auto-reply` | CRUD keyword entry point |
| Logs | `/admin/whatsapp/logs` | Monitoring histori automation dan filter |
| Webhook | `/admin/whatsapp/webhook` | Monitoring event webhook secara read-only |
| Settings | `/admin/whatsapp/settings` | Konfigurasi global API, webhook, timezone, retry, delay, dan debug |

Dashboard tidak menyediakan Chat Inbox, Broadcast, Contacts, CRM, Assignment, Label Management, Gateway, atau fitur lain di luar PRD.

## Persiapan Database

1. Buka SQL Editor di project Supabase yang dipakai ILJ Hub.
2. Jalankan isi `supabase-migration-whatsapp-manager.sql`.
3. Pastikan delapan tabel berikut terbentuk:

   - `templates`
   - `automation`
   - `flows`
   - `flow_nodes`
   - `auto_reply`
   - `logs`
   - `webhook_logs`
   - `settings`

Migration bersifat idempotent dan tidak mengubah tabel lama `whatsapp_templates`. Tabel lama tetap dipertahankan karena masih dipakai command processor existing.

Semua tabel manager memakai Row Level Security dan hanya role `authenticated` yang mendapat akses. Route API juga memeriksa user Supabase sebelum membaca atau mengubah data.

## Arsitektur

```text
Admin UI
  -> reusable hook/client service
  -> /api/admin/whatsapp/*
  -> WhatsApp manager service + Zod
  -> Supabase

Quick action Test API
  -> /api/admin/whatsapp
  -> server-side Kirim.dev client
  -> Kirim.dev API
```

Business logic dan validasi tidak diletakkan di komponen. Pembagian utamanya:

- `src/types/whatsapp-manager.ts`: kontrak data reusable.
- `src/validation/whatsapp-manager.ts`: schema Zod semua form/resource.
- `src/constants/whatsapp-manager.ts`: menu, label, trigger, action, dan urutan flow default.
- `src/services/whatsapp-manager-service.ts`: akses Supabase, relasi, metrik, dan flow default.
- `src/services/whatsapp-manager-client.ts`: transport HTTP dari UI ke backend.
- `src/hooks/use-manager-resource.ts`: state loading/error/refresh reusable.
- `src/components/whatsapp/*`: komponen halaman dan UI domain.
- `src/app/api/admin/whatsapp/*`: route handler terautentikasi.

## Walkthrough Penggunaan

### 1. Membuat Template

1. Buka **WhatsApp → Templates**.
2. Klik **Template**.
3. Isi nama, kategori, dan pilih jenis.
4. Form akan menyesuaikan jenis:

   - Text: body.
   - Image/Video/Document: URL media dan caption.
   - Reply Button/URL Button: header, body, footer, dan maksimal tiga tombol.
   - List Message: header, body, footer, section, dan rows.

5. Klik **Simpan**.

Template hanya menyimpan konfigurasi. Browser tidak mengirim pesan ke Kirim.dev.

### 2. Membuat Automation

1. Buka **Automation** dan klik **Automation**.
2. Pilih trigger.
3. Isi condition field, operator, dan value.
4. Pilih action dan template bila action adalah `Send Template`.
5. Simpan dan atur status aktif/nonaktif.

Quick action **Test Automation** di Overview hanya memeriksa jumlah konfigurasi aktif. Aksi tersebut tidak mengirim WhatsApp.

### 3. Membuat Customer Flow

1. Buka **Flow Builder** dan klik **Flow**.
2. Isi nama serta deskripsi.
3. Setelah disimpan, backend otomatis membuat urutan:

```text
Start → Welcome → Waiting Poster → Poster Approved → Send Pricelist
→ Choose Package → Offer PIN → Payment → Payment Success
→ Ask Instagram → Queue → Done
```

4. Klik ikon edit pada node untuk memilih template, automation, dan next step.

Flow Builder hanya menyimpan hubungan customer journey dan tidak menjadi automation builder atau pengirim pesan.

### 4. Menentukan Auto Reply

1. Buka **Auto Reply** dan klik **Keyword**.
2. Isi keyword pertama, misalnya `halo`.
3. Pilih template respons dan flow tujuan.
4. Simpan.

Keyword dinormalisasi menjadi huruf kecil. Setelah customer masuk flow, automation backend yang mengambil alih.

### 5. Monitoring

- **Overview** menampilkan status dan agregasi konfigurasi.
- **Logs** dapat difilter berdasarkan tanggal, automation, status, dan customer.
- **Webhook** menampilkan incoming/outgoing, event, status, latency, dan retry tanpa menyediakan edit.

### 6. Settings

Settings menyimpan API key, webhook URL, timezone, retry, delay default, dan debug mode. API key dimasking sebelum dikirim kembali ke browser. Bila field masih berisi nilai mask, backend mempertahankan secret lama saat settings lain disimpan.

## Endpoint Internal

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/admin/whatsapp` | Overview, akun server-side, dan webhook URL |
| POST | `/api/admin/whatsapp` | `test_connection`, `test_automation`, atau `sync_templates` |
| GET | `/api/admin/whatsapp/[resource]` | List dan filter resource |
| POST | `/api/admin/whatsapp/[resource]` | Membuat konfigurasi |
| PATCH | `/api/admin/whatsapp/[resource]/[id]` | Memperbarui konfigurasi |
| DELETE | `/api/admin/whatsapp/[resource]/[id]` | Menghapus konfigurasi yang diizinkan |

Resource `logs` dan `webhook_logs` read-only dari dashboard. `settings` tidak dapat dihapus.

## Verifikasi

Pemeriksaan yang dijalankan setelah implementasi:

```text
npx tsc --noEmit --pretty false
  PASS

npx eslint <seluruh file WhatsApp Manager> --max-warnings=0
  PASS

npm run build
  PASS — semua 8 halaman dan 3 pola route API terdaftar
```

Lint global repo masih melaporkan masalah existing pada generated asset Android dan beberapa modul lama di luar scope. File WhatsApp Manager yang baru telah lulus lint tanpa warning.

## Catatan Operasional

- Jalankan migration sebelum membuka modul; UI akan menampilkan pesan setup bila tabel belum tersedia.
- **Sync Template** memperbarui penanda `synced_at` untuk template aktif. Sinkronisasi payload eksternal penuh memerlukan spesifikasi endpoint template Kirim.dev yang belum diberikan di PRD.
- Credential existing pada `.env.local`, sidebar, header, dan konfigurasi Next.js/Tailwind tidak diubah.
- Webhook producer/backend perlu menulis ke `logs` dan `webhook_logs` agar monitoring menampilkan event nyata.

