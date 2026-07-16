# Instruksi Codex — Implementasi WhatsApp Inbox Kirimdev pada Dashboard Next.js + Supabase

> Gunakan dokumen ini sebagai **spesifikasi kerja utama**. Baca seluruh dokumen sebelum mengubah kode.  
> Targetnya adalah menambahkan menu WhatsApp Inbox pada dashboard admin yang sudah ada, bukan membuat aplikasi baru.

---

## 1. Konteks proyek

Aplikasi yang sudah tersedia:

- Website dan dashboard admin sudah berjalan.
- Framework utama: Next.js.
- Database dan autentikasi: Supabase.
- Sistem navigasi/menu dashboard sudah tersedia.
- Integrasi WhatsApp menggunakan API resmi Kirimdev.
- Yang perlu ditambahkan adalah menu dan halaman inbox WhatsApp bergaya shared inbox:
  - daftar filter;
  - daftar percakapan;
  - isi chat;
  - mengirim balasan;
  - pesan masuk real-time;
  - status terkirim/dibaca;
  - penanggung jawab;
  - label;
  - prioritas;
  - status percakapan.

Jangan membuat dashboard kedua, autentikasi kedua, layout kedua, atau desain yang tidak konsisten dengan aplikasi yang sudah ada.

---

## 2. Tujuan akhir

Tambahkan satu modul bernama **WhatsApp Inbox** ke dashboard admin yang sudah ada.

Modul harus memungkinkan admin atau petugas yang berizin untuk:

1. Melihat daftar percakapan WhatsApp.
2. Mencari percakapan berdasarkan nama, nomor, atau isi pesan.
3. Memfilter berdasarkan:
   - semua;
   - belum dibaca;
   - belum dibalas;
   - terbuka;
   - menunggu;
   - selesai;
   - penanggung jawab;
   - prioritas;
   - label.
4. Membuka percakapan dan membaca riwayat pesan.
5. Mengirim pesan teks.
6. Melihat status pesan:
   - pending;
   - sent;
   - delivered;
   - read;
   - failed.
7. Menandai pesan masuk sebagai dibaca.
8. Mengubah status percakapan.
9. Mengatur prioritas percakapan.
10. Menetapkan percakapan kepada user/agent.
11. Menambahkan dan menghapus label.
12. Menggunakan quick reply.
13. Menerima pesan dan perubahan status secara real-time.
14. Menampilkan peringatan ketika jendela layanan WhatsApp 24 jam sudah berakhir.
15. Menggunakan template WhatsApp untuk memulai kembali percakapan di luar jendela 24 jam pada tahap berikutnya.

---

## 3. Aturan wajib sebelum menulis kode

### 3.1 Audit repository terlebih dahulu

Sebelum membuat atau mengubah file apa pun, periksa:

- `package.json`;
- package manager yang digunakan;
- apakah memakai App Router atau Pages Router;
- struktur route dashboard;
- layout dashboard;
- komponen sidebar/menu;
- library UI yang sudah digunakan;
- pola styling;
- dark mode;
- client Supabase browser;
- client Supabase server;
- middleware autentikasi;
- struktur role/permission;
- tabel organisasi/tenant;
- tabel profil/user;
- pola migration Supabase;
- pola API route/server action;
- library validasi;
- pola toast dan error handling;
- library data fetching;
- penggunaan Supabase Realtime;
- test runner;
- konfigurasi lint dan TypeScript.

Buat catatan audit singkat di:

```text
docs/whatsapp-inbox-audit.md
```

Isi catatan tersebut minimal:

- stack yang ditemukan;
- route yang akan digunakan;
- file navigasi yang akan diubah;
- tabel tenant dan user yang akan direferensikan;
- pola autentikasi yang akan dipakai;
- daftar dependency baru jika benar-benar diperlukan;
- risiko konflik dengan struktur yang sudah ada.

### 3.2 Ikuti konvensi proyek

Wajib:

- Gunakan komponen UI, helper, naming convention, alias import, dan pola folder yang sudah ada.
- Jangan memasang library baru jika fungsi yang sama sudah tersedia.
- Jangan mengganti desain global.
- Jangan melakukan refactor besar di luar modul WhatsApp.
- Jangan menghapus fitur lama.
- Jangan menaruh mock data pada hasil akhir.
- Jangan membuat client Supabase tambahan apabila client yang benar sudah tersedia.
- Jangan membuat sistem role baru apabila role sudah tersedia.
- Jangan membuat tabel organisasi baru apabila proyek sudah memiliki konsep tenant/organization/workspace.

### 3.3 Jangan menebak skema relasi

Nama seperti `tenant_id`, `organization_id`, `profile_id`, atau `user_id` pada dokumen ini adalah konsep.

Codex wajib menyesuaikannya dengan skema proyek yang sebenarnya setelah audit repository.

Apabila aplikasi bukan multi-tenant, tetap pertahankan struktur yang sederhana dan jangan menambahkan tenant abstraction yang tidak diperlukan.

---

## 4. Batasan keamanan yang tidak boleh dilanggar

1. `KIRIMDEV_API_KEY` hanya boleh digunakan di server.
2. Jangan pernah menggunakan prefix `NEXT_PUBLIC_` untuk API key atau webhook secret.
3. Jangan memanggil Kirimdev langsung dari Client Component.
4. Jangan mengirim service-role key Supabase ke browser.
5. Semua route admin harus memverifikasi:
   - sesi login;
   - role/permission;
   - tenant/organization scope.
6. Webhook tidak menggunakan sesi user, tetapi wajib memverifikasi HMAC.
7. Webhook harus membaca **raw body sebelum JSON parsing**.
8. Webhook wajib idempotent karena event dapat dikirim lebih dari sekali.
9. Semua input user wajib divalidasi.
10. Jangan mencatat API key, webhook secret, isi authorization header, atau seluruh payload sensitif ke log production.
11. Semua query database harus dibatasi oleh tenant/account yang benar.
12. Jangan membuat RLS terbuka seperti `using (true)` untuk data WhatsApp.
13. Jangan merender HTML pesan mentah.
14. Batasi request pengiriman agar klik ganda tidak mengirim pesan duplikat.
15. Terapkan rate limiting apabila proyek sudah memiliki fasilitas rate limiter.

---

## 5. Arsitektur yang harus digunakan

Gunakan arsitektur hybrid berikut:

```text
WhatsApp user
    ↓
Meta WhatsApp
    ↓
Kirimdev
    ├── REST API
    └── signed webhook
            ↓
Next.js server
    ├── verifikasi signature
    ├── normalisasi event
    ├── upsert ke Supabase
    └── response 2xx
            ↓
Supabase PostgreSQL
    ↓
Supabase Realtime
    ↓
Dashboard admin
```

Untuk pesan keluar:

```text
Dashboard admin
    ↓
Next.js API route/server action
    ├── cek session dan permission
    ├── validasi payload
    ├── buat optimistic/local pending message
    ├── panggil Kirimdev
    └── simpan/reconcile provider ID
            ↓
Kirimdev
    ↓
WhatsApp
```

### Sumber data aplikasi

Gunakan Supabase sebagai sumber data utama untuk UI inbox.

Kirimdev digunakan untuk:

- mengirim pesan;
- mengambil initial/backfill data;
- rekonsiliasi;
- membaca data provider yang belum ada secara lokal;
- menerima webhook pesan dan status.

Jangan membuat UI melakukan fetch langsung ke Kirimdev untuk setiap render.

---

## 6. Fakta API Kirimdev yang menjadi dasar implementasi

Base URL:

```text
https://api.kirimdev.com/v1
```

Autentikasi:

```http
Authorization: Bearer <KIRIMDEV_API_KEY>
```

Endpoint utama:

```http
GET    /accounts

GET    /{phone_number_id}/conversations
GET    /{phone_number_id}/conversations/{id}
PATCH  /{phone_number_id}/conversations/{id}

POST   /{phone_number_id}/conversations/{id}/labels
DELETE /{phone_number_id}/conversations/{id}/labels/{label_id}

GET    /{phone_number_id}/messages
POST   /{phone_number_id}/messages
GET    /{phone_number_id}/messages/{id}
GET    /{phone_number_id}/messages/{id}/media

GET    /{phone_number_id}/contacts
GET    /{phone_number_id}/contacts/{id}
PATCH  /{phone_number_id}/contacts/{id}

GET    /{phone_number_id}/templates

GET    /labels
POST   /labels
PATCH  /labels/{id}
DELETE /labels/{id}

GET    /webhook_subscriptions
POST   /webhook_subscriptions
PATCH  /webhook_subscriptions/{id}
DELETE /webhook_subscriptions/{id}
```

Daftar pesan dapat difilter menggunakan data seperti:

- `conversation_id`;
- `direction`;
- `status`;
- `created_after`;
- `created_before`;
- cursor pagination.

Contoh kirim teks:

```json
{
  "messaging_product": "whatsapp",
  "to": "+628123456789",
  "type": "text",
  "text": {
    "body": "Halo Kak, terima kasih sudah menghubungi kami."
  }
}
```

Contoh reply terhadap pesan:

```json
{
  "messaging_product": "whatsapp",
  "to": "+628123456789",
  "type": "text",
  "context": {
    "message_id": "wamid.xxxxx"
  },
  "text": {
    "body": "Baik Kak, informasinya sudah kami terima."
  }
}
```

Contoh menandai pesan sebagai dibaca:

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.xxxxx"
}
```

Header signature webhook:

```http
X-Kirim-Signature: t=<unix_timestamp>,v1=<hmac_hex>
```

Data yang ditandatangani:

```text
<t>.<raw_body>
```

Algoritma:

```text
HMAC-SHA256
```

Gunakan toleransi waktu 300 detik dan constant-time comparison.

Deduplikasi webhook menggunakan:

```http
X-Kirim-Event-Id
```

Event penting:

```text
message.received
message.sent
message.status
message.revoked
message.edited
conversation.assigned
conversation.closed
contact.created
contact.updated
contact.identity_updated
```

Webhook Kirimdev bersifat at-least-once. Event yang sama dapat diterima kembali, sehingga semua handler wajib aman terhadap retry.

Referensi resmi yang harus dicek kembali ketika implementasi:

```text
https://docs.kirimdev.com/api/
https://docs.kirimdev.com/webhooks/events/
https://docs.kirimdev.com/webhooks/signing/
https://docs.kirimdev.com/webhooks/payloads/
https://docs.kirimdev.com/sending/send-text/
https://docs.kirimdev.com/sending/mark-as-read/
https://docs.kirimdev.com/guides/sync-crm/
```

Jangan mengarang field response. Buat type berdasarkan response aktual dari API atau OpenAPI Kirimdev.

---

## 7. Environment variables

Tambahkan ke `.env.example`, bukan nilai asli:

```env
# Kirimdev — server only
KIRIMDEV_API_BASE_URL=https://api.kirimdev.com/v1
KIRIMDEV_API_KEY=
KIRIMDEV_PHONE_NUMBER_ID=
KIRIMDEV_WEBHOOK_SECRET_PRIMARY=
KIRIMDEV_WEBHOOK_SECRET_SECONDARY=

# Opsional: hanya jika route sinkronisasi internal menggunakan secret
WHATSAPP_SYNC_SECRET=
```

Ketentuan:

- Jangan menambahkan nilai asli ke Git.
- `KIRIMDEV_WEBHOOK_SECRET_SECONDARY` digunakan saat rotasi secret.
- Gunakan utility validasi environment apabila proyek sudah memilikinya.
- Aplikasi harus gagal dengan pesan konfigurasi yang jelas apabila env wajib belum tersedia.
- Jangan menampilkan nilai secret pada error response.

---

## 8. Struktur modul yang disarankan

Sesuaikan dengan struktur repository. Jangan memaksakan path ini apabila proyek memakai konvensi lain.

```text
app/
  admin/
    whatsapp/
      page.tsx
      loading.tsx
      error.tsx

  api/
    admin/
      whatsapp/
        conversations/
          route.ts
          [conversationId]/
            route.ts
            messages/
              route.ts
            labels/
              route.ts
        messages/
          route.ts
          [messageId]/
            retry/
              route.ts
        quick-replies/
          route.ts
        sync/
          route.ts

    webhooks/
      kirimdev/
        route.ts

components/
  whatsapp/
    whatsapp-inbox.tsx
    inbox-filter-sidebar.tsx
    account-switcher.tsx
    conversation-list.tsx
    conversation-list-item.tsx
    chat-panel.tsx
    chat-header.tsx
    message-timeline.tsx
    message-bubble.tsx
    message-status-icon.tsx
    message-composer.tsx
    quick-reply-picker.tsx
    conversation-details.tsx
    label-picker.tsx
    assignee-picker.tsx
    priority-picker.tsx
    template-picker.tsx
    empty-conversation.tsx

lib/
  whatsapp/
    kirimdev/
      client.ts
      types.ts
      schemas.ts
      mapper.ts
      webhook.ts
    repositories/
      accounts.ts
      contacts.ts
      conversations.ts
      messages.ts
      webhook-events.ts
    services/
      send-message.ts
      mark-read.ts
      sync.ts
      process-webhook.ts
      conversation-state.ts
    constants.ts
    permissions.ts
    errors.ts

supabase/
  migrations/
    <timestamp>_create_whatsapp_inbox.sql

scripts/
  kirimdev-sync.ts
  kirimdev-subscribe-webhook.ts

docs/
  whatsapp-inbox-audit.md
  whatsapp-inbox-setup.md
```

---

## 9. Database Supabase

### 9.1 Prinsip skema

- Gunakan UUID internal sebagai primary key.
- Simpan ID provider secara terpisah.
- Jangan memakai `provider_message_id` sebagai primary key database.
- Tambahkan unique constraint untuk mencegah duplikasi.
- Simpan raw payload dalam `jsonb` untuk debugging dan kompatibilitas field baru.
- Gunakan timestamp provider dan timestamp lokal secara terpisah.
- Gunakan foreign key ke tenant/account/contact/conversation.
- Adaptasikan foreign key user ke tabel user/profile yang sudah ada.
- Tambahkan index untuk query inbox.
- Aktifkan RLS.
- Gunakan trigger `updated_at` yang sudah ada apabila proyek memilikinya.

### 9.2 Tabel minimum

#### `wa_accounts`

Kolom yang dibutuhkan:

```text
id                         uuid primary key
tenant_id                  uuid / tipe tenant yang sudah ada
provider                   text default 'kirimdev'
provider_account_id        text nullable
phone_number_id            text not null
display_phone_number       text nullable
display_name               text nullable
status                     text nullable
metadata                   jsonb default '{}'
last_synced_at             timestamptz nullable
created_at                 timestamptz
updated_at                 timestamptz
```

Constraint:

```text
unique (tenant_id, provider, phone_number_id)
```

#### `wa_contacts`

```text
id                         uuid primary key
tenant_id                  uuid
wa_account_id              uuid references wa_accounts
provider_contact_id        text nullable
wa_id                      text nullable
business_scoped_user_id    text nullable
recipient_key              text not null
phone_number               text nullable
name                       text nullable
profile_name               text nullable
email                      text nullable
avatar_url                 text nullable
metadata                   jsonb default '{}'
provider_created_at        timestamptz nullable
provider_updated_at        timestamptz nullable
last_synced_at             timestamptz nullable
created_at                 timestamptz
updated_at                 timestamptz
```

`recipient_key` harus dapat mewakili nomor telepon atau Business-Scoped User ID.

Constraint yang disarankan:

```text
unique (wa_account_id, provider_contact_id)
unique (wa_account_id, recipient_key)
```

Gunakan partial unique index apabila kolom provider dapat `null`.

#### `wa_conversations`

```text
id                         uuid primary key
tenant_id                  uuid
wa_account_id              uuid references wa_accounts
wa_contact_id              uuid references wa_contacts
provider_conversation_id   text not null
status                     text not null
priority                   text not null default 'normal'
assigned_user_id           uuid nullable
provider_assignee_id       text nullable
last_message_preview       text nullable
last_message_type          text nullable
last_message_direction     text nullable
last_message_at            timestamptz nullable
last_inbound_at            timestamptz nullable
last_outbound_at           timestamptz nullable
service_window_expires_at  timestamptz nullable
unread_count               integer not null default 0
needs_reply                boolean not null default false
is_archived                boolean not null default false
metadata                   jsonb default '{}'
provider_created_at        timestamptz nullable
provider_updated_at        timestamptz nullable
last_synced_at             timestamptz nullable
created_at                 timestamptz
updated_at                 timestamptz
```

Allowed status lokal:

```text
open
pending
resolved
```

Allowed priority lokal:

```text
low
normal
high
urgent
```

Constraint:

```text
unique (wa_account_id, provider_conversation_id)
check (unread_count >= 0)
```

Index minimum:

```text
(tenant_id, status, last_message_at desc)
(tenant_id, assigned_user_id, last_message_at desc)
(wa_account_id, last_message_at desc)
(wa_contact_id)
(needs_reply, last_message_at desc)
```

#### `wa_messages`

```text
id                         uuid primary key
tenant_id                  uuid
wa_account_id              uuid references wa_accounts
wa_conversation_id         uuid references wa_conversations
wa_contact_id              uuid references wa_contacts
provider_message_id        text nullable
provider_wamid             text nullable
client_request_id          uuid nullable
direction                  text not null
message_type               text not null
body                       text nullable
status                     text nullable
source                     text nullable
reply_to_provider_wamid    text nullable
media_url                  text nullable
media_mime_type            text nullable
media_filename             text nullable
media_status               text nullable
sender_user_id             uuid nullable
error_code                 text nullable
error_message              text nullable
payload                    jsonb default '{}'
provider_created_at        timestamptz nullable
sent_at                    timestamptz nullable
delivered_at               timestamptz nullable
read_at                    timestamptz nullable
failed_at                  timestamptz nullable
created_at                 timestamptz
updated_at                 timestamptz
```

Allowed direction:

```text
inbound
outbound
system
```

Allowed status:

```text
pending
sent
delivered
read
failed
```

Unique index:

```text
unique (wa_account_id, provider_message_id) where provider_message_id is not null
unique (wa_account_id, provider_wamid) where provider_wamid is not null
unique (wa_account_id, client_request_id) where client_request_id is not null
```

Index:

```text
(wa_conversation_id, provider_created_at desc, created_at desc)
(provider_wamid)
(status)
```

#### `wa_labels`

```text
id                         uuid primary key
tenant_id                  uuid
provider_label_id          text nullable
name                       text not null
color                      text nullable
is_local                   boolean not null default false
metadata                   jsonb default '{}'
created_at                 timestamptz
updated_at                 timestamptz
```

Constraint:

```text
unique (tenant_id, name)
unique (tenant_id, provider_label_id) where provider_label_id is not null
```

#### `wa_conversation_labels`

```text
wa_conversation_id         uuid references wa_conversations on delete cascade
wa_label_id                uuid references wa_labels on delete cascade
created_by                 uuid nullable
created_at                 timestamptz
primary key (wa_conversation_id, wa_label_id)
```

#### `wa_quick_replies`

```text
id                         uuid primary key
tenant_id                  uuid
shortcut                   text not null
title                      text not null
body                       text not null
is_active                  boolean not null default true
sort_order                 integer not null default 0
created_by                 uuid nullable
updated_by                 uuid nullable
created_at                 timestamptz
updated_at                 timestamptz
```

Constraint:

```text
unique (tenant_id, shortcut)
```

#### `wa_webhook_events`

```text
id                         uuid primary key
provider_event_id          text not null
event_type                 text not null
wa_account_id              uuid nullable
signature_timestamp        bigint nullable
headers                    jsonb default '{}'
payload                    jsonb not null
processing_status          text not null default 'received'
attempt_count              integer not null default 1
processing_error           text nullable
received_at                timestamptz not null
processed_at               timestamptz nullable
created_at                 timestamptz
updated_at                 timestamptz
```

Constraint:

```text
unique (provider_event_id)
```

Allowed processing status:

```text
received
processing
processed
ignored
failed
```

#### `wa_sync_state`

```text
id                         uuid primary key
wa_account_id              uuid references wa_accounts
resource_type              text not null
cursor                     text nullable
last_success_at            timestamptz nullable
last_error_at              timestamptz nullable
last_error                  text nullable
metadata                   jsonb default '{}'
created_at                 timestamptz
updated_at                 timestamptz
```

Constraint:

```text
unique (wa_account_id, resource_type)
```

---

## 10. RLS dan permission

Codex harus menyesuaikan policy dengan sistem authorization yang sudah ada.

Minimum behavior:

- User biasa tanpa permission inbox tidak dapat membaca data WhatsApp.
- Agent dapat membaca percakapan milik tenant yang sama.
- Agent dapat mengirim pesan jika memiliki permission.
- Admin dapat mengubah assignment, priority, status, label, dan quick reply.
- Webhook memakai server/service role dan tidak bergantung pada RLS user.
- Tidak ada akses lintas tenant.
- Semua mutation mencatat `sender_user_id`, `created_by`, atau audit actor apabila relevan.

Jangan membuat policy generik yang mengizinkan semua authenticated user.

Gunakan helper permission/RLS yang sudah ada di proyek.

---

## 11. Kirimdev server client

Buat client server-only.

Persyaratan:

- Tambahkan `import "server-only"` apabila App Router mendukungnya.
- Gunakan timeout.
- Tangani response non-2xx.
- Parse error secara aman.
- Simpan `X-Request-Id` jika tersedia untuk troubleshooting.
- Tangani `429` dengan informasi retry.
- Jangan retry otomatis untuk send tanpa idempotency key.
- Gunakan cursor opaque apa adanya.
- Jangan membangun cursor sendiri.
- Jangan mencetak bearer token.

Interface minimum:

```ts
type KirimdevClient = {
  listAccounts(): Promise<unknown>;
  listConversations(input: {
    phoneNumberId: string;
    cursor?: string;
    limit?: number;
    status?: string;
    updatedSince?: string;
  }): Promise<unknown>;

  getConversation(input: {
    phoneNumberId: string;
    conversationId: string;
  }): Promise<unknown>;

  updateConversation(input: {
    phoneNumberId: string;
    conversationId: string;
    status?: "open" | "pending" | "resolved";
    assignedTo?: string | null;
  }): Promise<unknown>;

  listMessages(input: {
    phoneNumberId: string;
    conversationId?: string;
    cursor?: string;
    limit?: number;
    direction?: "inbound" | "outbound";
    status?: string;
    createdAfter?: string;
    createdBefore?: string;
  }): Promise<unknown>;

  sendMessage(input: {
    phoneNumberId: string;
    body: unknown;
    idempotencyKey: string;
  }): Promise<unknown>;

  markAsRead(input: {
    phoneNumberId: string;
    providerWamid: string;
  }): Promise<unknown>;

  listTemplates(input: {
    phoneNumberId: string;
    cursor?: string;
  }): Promise<unknown>;
};
```

Gunakan schema validator terhadap response eksternal jika library validasi seperti Zod sudah tersedia.

Simpan response mentah di `payload`, tetapi map hanya field yang dipakai oleh aplikasi.

---

## 12. Webhook Kirimdev

Route yang disarankan:

```text
POST /api/webhooks/kirimdev
```

Pada App Router:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Urutan handler wajib:

1. Ambil `request.text()`.
2. Ambil `X-Kirim-Signature`.
3. Ambil `X-Kirim-Event-Id`.
4. Ambil `X-Kirim-Event`.
5. Verifikasi signature terhadap semua secret aktif.
6. Tolak signature invalid dengan `401`.
7. Tolak timestamp terlalu lama.
8. Parse JSON setelah signature valid.
9. Insert event dengan unique `provider_event_id`.
10. Jika sudah pernah ada, balas `200` tanpa memproses ulang.
11. Proses event secara idempotent dalam transaction bila memungkinkan.
12. Tandai event sebagai `processed`, `ignored`, atau `failed`.
13. Balas 2xx hanya ketika event sudah diterima secara aman.

Contoh verifikasi tanpa ketergantungan SDK:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyKirimdevSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secrets: string[];
  toleranceSeconds?: number;
}): boolean {
  const {
    rawBody,
    signatureHeader,
    secrets,
    toleranceSeconds = 300,
  } = input;

  if (!signatureHeader || secrets.length === 0) return false;

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampText = parts
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  const timestamp = Number(timestampText);

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    return false;
  }

  const currentEpoch = Math.floor(Date.now() / 1000);

  if (Math.abs(currentEpoch - timestamp) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;

  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(signedPayload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");

    return signatures.some((received) => {
      if (!/^[a-f0-9]+$/i.test(received)) return false;

      const receivedBuffer = Buffer.from(received, "hex");

      return (
        expectedBuffer.length === receivedBuffer.length &&
        timingSafeEqual(expectedBuffer, receivedBuffer)
      );
    });
  });
}
```

Buat unit test untuk:

- signature valid;
- signature invalid;
- body berubah;
- timestamp kedaluwarsa;
- multiple active secrets;
- header tidak lengkap;
- hex invalid.

### Event handling

#### `message.received`

Lakukan:

- identifikasi `phone_number_id`;
- upsert account;
- upsert contact;
- upsert conversation;
- upsert inbound message;
- set `last_message_direction = inbound`;
- update preview;
- update `last_message_at`;
- update `last_inbound_at`;
- set `service_window_expires_at = inbound_time + 24 hours`;
- increment unread secara idempotent;
- set `needs_reply = true`;
- publish perubahan melalui Supabase Realtime secara alami lewat perubahan tabel.

Jangan menambah unread dua kali ketika event retry.

#### `message.sent`

Lakukan:

- upsert outbound message;
- reconcile optimistic message menggunakan:
  - `client_request_id`, jika tersedia;
  - provider ID;
  - WAMID;
  - idempotency metadata;
- set `last_message_direction = outbound`;
- update preview;
- update `last_message_at`;
- update `last_outbound_at`;
- set `needs_reply = false`.

#### `message.status`

Cari message berdasarkan `provider_wamid` atau provider message ID.

Update status secara monotonic:

```text
pending < sent < delivered < read
```

`failed` dapat diterapkan dari status yang relevan.

Jangan menurunkan status `read` kembali menjadi `sent` apabila event datang tidak berurutan.

Simpan error code dan error message jika tersedia.

#### `message.edited`

- Update body/payload.
- Simpan metadata bahwa pesan diedit.
- Jangan membuat row duplikat.

#### `message.revoked`

- Tandai metadata revoked.
- Pertahankan row untuk audit.
- UI menampilkan “Pesan dihapus”.

#### `conversation.assigned`

- Update provider assignee.
- Map ke user lokal jika mapping tersedia.
- Jangan menghapus assignment lokal apabila provider payload tidak lengkap.

#### `conversation.closed`

- Set status lokal menjadi `resolved`.

#### `contact.created` / `contact.updated`

- Upsert contact.
- Hindari update loop jika aplikasi juga melakukan sync balik.

#### `contact.identity_updated`

- Update recipient identifier/BSUID secara aman.
- Jangan membuat contact kedua hanya karena identitas provider berubah.

### Normalizer

Payload `message.received` dapat berbentuk Meta-style, sedangkan event native Kirimdev memakai envelope yang dinormalisasi.

Buat layer normalizer:

```ts
normalizeKirimdevEvent({
  eventType,
  eventId,
  headers,
  payload,
}): NormalizedWhatsappEvent
```

Jangan menyebarkan parsing payload provider ke komponen UI atau repository.

Gunakan fixture dari dokumentasi payload resmi untuk test.

---

## 13. Initial sync dan reconciliation

Buat script atau service initial sync.

Urutan:

1. Ambil account dari `GET /accounts`.
2. Cocokkan dengan `KIRIMDEV_PHONE_NUMBER_ID`.
3. Upsert `wa_accounts`.
4. Ambil conversations menggunakan cursor pagination.
5. Upsert contact dan conversation.
6. Jangan langsung mengambil seluruh message history untuk semua conversation apabila volumenya besar.
7. Untuk tahap awal:
   - backfill conversation aktif;
   - backfill message terbaru per conversation;
   - fetch message history lebih lama secara lazy ketika user scroll.
8. Simpan cursor sync di `wa_sync_state`.
9. Buat mekanisme reconciliation yang dapat dijalankan ulang tanpa duplikasi.

Gunakan dua alur:

- webhook untuk perubahan real-time;
- pull/cursor sync untuk initial import dan recovery.

Route sync manual harus:

- hanya dapat dipanggil admin;
- atau menggunakan secret internal;
- tidak dapat diakses publik tanpa proteksi;
- memiliki lock agar dua proses sync tidak berjalan bersamaan;
- menghasilkan summary jumlah insert/update/error.

Jangan otomatis membuat webhook subscription setiap aplikasi start.

Buat script terpisah:

```text
scripts/kirimdev-subscribe-webhook.ts
```

Script harus:

- membaca URL webhook dari argument/env;
- membuat subscription hanya atas perintah operator;
- mencetak subscription ID;
- memperingatkan bahwa `initial_secret` hanya ditampilkan sekali;
- tidak menulis secret ke Git;
- tidak mencetak API key.

---

## 14. API internal aplikasi

Nama route boleh disesuaikan dengan konvensi proyek.

### List conversations

```http
GET /api/admin/whatsapp/conversations
```

Query yang didukung:

```text
accountId
status
priority
assignee
label
unread
needsReply
search
cursor
limit
```

Response harus menggunakan cursor pagination, bukan offset untuk data besar.

Sorting default:

```text
last_message_at desc nulls last
```

### Conversation detail

```http
GET /api/admin/whatsapp/conversations/{conversationId}
```

Response:

- conversation;
- contact;
- labels;
- assignee;
- window 24 jam;
- permission aksi user saat ini.

### Messages

```http
GET /api/admin/whatsapp/conversations/{conversationId}/messages
```

Query:

```text
cursor
limit
before
```

Urutan UI harus kronologis, walaupun query database dapat mengambil data terbaru terlebih dahulu.

### Send message

```http
POST /api/admin/whatsapp/messages
```

Payload internal:

```json
{
  "conversationId": "uuid",
  "clientRequestId": "uuid",
  "type": "text",
  "text": "Isi pesan",
  "replyToProviderWamid": null
}
```

Flow:

1. cek auth;
2. cek permission;
3. cek tenant;
4. cek conversation/account;
5. cek service window;
6. validasi panjang pesan;
7. insert/upsert local pending message memakai `clientRequestId`;
8. panggil Kirimdev memakai idempotency key stabil;
9. update provider ID/WAMID dari response;
10. jika gagal, tandai failed;
11. return message lokal yang sudah dinormalisasi.

Idempotency key yang disarankan:

```text
wa-send:<tenant-or-account-id>:<clientRequestId>
```

Jangan menggunakan random idempotency key baru ketika user menekan retry untuk message yang sama.

### Mark read

Ketika conversation dibuka:

1. reset unread lokal ke 0 dalam transaksi;
2. ambil inbound WAMID terbaru yang belum ditandai read;
3. panggil Kirimdev mark-as-read;
4. kegagalan provider tidak boleh mengembalikan unread lokal menjadi nilai negatif;
5. log failure untuk retry ringan.

### Update conversation

```http
PATCH /api/admin/whatsapp/conversations/{conversationId}
```

Payload yang diizinkan:

```json
{
  "status": "open | pending | resolved",
  "priority": "low | normal | high | urgent",
  "assignedUserId": "uuid | null"
}
```

Aturan:

- status provider disinkronkan ke Kirimdev apabila endpoint mendukungnya;
- priority disimpan lokal;
- assignment lokal dan provider harus memiliki aturan source-of-truth yang jelas;
- jangan menerima field arbitrary.

### Labels

```http
POST   /api/admin/whatsapp/conversations/{conversationId}/labels
DELETE /api/admin/whatsapp/conversations/{conversationId}/labels/{labelId}
```

Gunakan provider label apabila label tersebut berasal dari Kirimdev. Label lokal boleh disimpan lokal, tetapi harus dibedakan dengan `is_local`.

---

## 15. Logika state percakapan

Buat fungsi domain yang dapat dites.

### `needs_reply`

Set `true` apabila pesan terbaru yang relevan adalah inbound dan belum ada outbound setelahnya.

Secara konseptual:

```ts
needsReply =
  lastInboundAt != null &&
  (lastOutboundAt == null || lastInboundAt > lastOutboundAt);
```

Jangan hanya mengandalkan isi preview.

### `unread_count`

- Increment sekali untuk setiap inbound message baru.
- Jangan increment pada webhook retry.
- Reset ke 0 saat agent membuka dan menandai read.
- Gunakan update atomic atau transaction.

### Service window

```ts
serviceWindowExpiresAt = lastInboundAt + 24 hours;
```

```ts
isServiceWindowOpen =
  serviceWindowExpiresAt != null &&
  serviceWindowExpiresAt.getTime() > Date.now();
```

Server tetap menjadi sumber keputusan utama. UI hanya menampilkan hasil.

Di luar jendela 24 jam:

- disable pengiriman free-form text;
- tampilkan pesan yang jelas;
- tampilkan tombol pemilih template apabila implementasi template sudah tersedia;
- jangan mencoba mengirim text biasa lalu mengandalkan error provider.

### Status message monotonic

Gunakan ranking:

```ts
const statusRank = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};
```

Event status yang lebih rendah tidak boleh menimpa status yang lebih tinggi.

---

## 16. UI/UX

### 16.1 Navigasi

Tambahkan item menu pada dashboard admin:

```text
WhatsApp Inbox
```

Icon mengikuti icon library yang sudah digunakan.

Route mengikuti pola proyek, contoh:

```text
/admin/whatsapp
```

Item menu hanya tampil untuk role yang memiliki permission.

### 16.2 Layout desktop

Gunakan layout tiga area di dalam dashboard yang sudah ada:

```text
┌─────────────────┬──────────────────────┬────────────────────────────┐
│ Filter Inbox    │ Daftar Percakapan   │ Isi Percakapan             │
│                 │                      │                            │
│ Akun            │ Search               │ Header kontak              │
│ Status          │ Conversation items   │ Timeline pesan             │
│ Assignee        │ Infinite scroll      │ Composer                   │
│ Priority        │                      │                            │
│ Labels          │                      │                            │
└─────────────────┴──────────────────────┴────────────────────────────┘
```

Ukuran referensi:

```css
grid-template-columns: 240px 360px minmax(0, 1fr);
```

Sesuaikan dengan sidebar dashboard dan breakpoint aktual.

Tinggi modul:

```css
min-height: calc(100dvh - var(--dashboard-header-height));
```

Hindari seluruh halaman ikut scroll. Idealnya:

- filter panel scroll sendiri;
- conversation list scroll sendiri;
- message timeline scroll sendiri;
- composer tetap terlihat.

### 16.3 Layout tablet/mobile

Pada layar kecil:

- conversation list menjadi halaman utama;
- filter menjadi drawer/sheet;
- chat terbuka sebagai panel penuh;
- tombol back mengembalikan ke conversation list;
- composer tidak tertutup keyboard;
- gunakan `100dvh`, bukan hanya `100vh`.

### 16.4 Conversation list item

Tampilkan:

- avatar/inisial;
- nama;
- nomor atau identifier;
- preview pesan terakhir;
- waktu relatif;
- unread badge;
- indikator kebutuhan balasan;
- status;
- priority;
- assignee;
- label ringkas;
- indikator message failed jika relevan.

Selected item harus jelas.

### 16.5 Chat header

Tampilkan:

- nama kontak;
- nomor/identifier;
- status conversation;
- assignee;
- priority;
- labels;
- indikator jendela 24 jam;
- action menu.

### 16.6 Message timeline

Dukung minimum:

- text;
- image placeholder;
- document placeholder;
- audio placeholder;
- video placeholder;
- interactive reply summary;
- unsupported message notice;
- deleted/revoked message;
- edited badge;
- reply quote.

Bubble:

- inbound di kiri;
- outbound di kanan;
- timestamp;
- status icon;
- nama agent untuk outbound bila tersedia;
- failed retry action.

Jangan memakai warna WhatsApp secara hardcoded apabila bertentangan dengan design system. Gunakan token tema aplikasi.

### 16.7 Composer

Minimum:

- textarea auto-grow;
- Enter untuk kirim;
- Shift+Enter untuk baris baru;
- tombol kirim;
- quick reply;
- reply-to;
- disabled state;
- loading state;
- failed state;
- character validation;
- warning window 24 jam.

Cegah pengiriman apabila:

- text kosong;
- sedang submit;
- user tidak punya izin;
- conversation tidak valid;
- service window sudah berakhir dan bukan template.

### 16.8 Search

Search minimum:

- nama contact;
- nomor/recipient identifier;
- preview;
- isi message.

Gunakan debounce 250–400 ms.

Untuk volume kecil dapat menggunakan `ILIKE`. Untuk production, pertimbangkan PostgreSQL full-text search dengan generated `tsvector` dan GIN index.

Search harus tetap terikat tenant dan account.

### 16.9 Loading, empty, dan error state

Sediakan:

- skeleton conversation list;
- skeleton message timeline;
- empty inbox;
- no search result;
- no selected conversation;
- provider configuration missing;
- webhook not configured;
- failed sync;
- failed send;
- reconnect/retry action.

Jangan hanya menampilkan stack trace.

### 16.10 Aksesibilitas

- Tombol memiliki accessible name.
- List dapat dinavigasi keyboard.
- Focus state terlihat.
- Composer dapat digunakan tanpa mouse.
- Badge tidak menjadi satu-satunya pembeda status.
- Kontras sesuai tema.
- `aria-live` untuk pesan baru secukupnya, jangan membacakan seluruh chat berulang kali.

---

## 17. Realtime Supabase

Gunakan Supabase Realtime terhadap tabel lokal, bukan koneksi langsung browser ke Kirimdev.

Subscribe minimal pada:

- `wa_messages`;
- `wa_conversations`;
- `wa_conversation_labels`.

Filter subscription berdasarkan tenant/account bila API dan struktur proyek memungkinkan.

Behavior:

- inbound message baru muncul di timeline tanpa reload;
- conversation pindah ke atas;
- unread badge berubah;
- status sent/delivered/read berubah;
- perubahan assignment/status/priority terlihat;
- hindari duplikasi antara optimistic message dan event realtime;
- unsubscribe saat component unmount;
- jangan membuat subscription baru pada setiap render.

Gunakan query cache yang sudah tersedia, misalnya TanStack Query atau SWR, bila proyek sudah menggunakannya.

---

## 18. Optimistic message dan deduplikasi frontend

Saat user mengirim:

1. Generate `clientRequestId` UUID.
2. Tampilkan bubble `pending`.
3. POST ke server.
4. Server upsert berdasarkan `clientRequestId`.
5. Webhook `message.sent` atau response API mengisi provider IDs.
6. Realtime update harus mengganti bubble pending, bukan menambah bubble kedua.
7. Jika gagal, ubah bubble menjadi `failed`.
8. Retry memakai `clientRequestId` yang sama atau relationship retry yang terkontrol.

Kunci reconcile:

```text
client_request_id
provider_message_id
provider_wamid
```

Gunakan urutan tersebut secara aman.

---

## 19. Template WhatsApp

Implementasi MVP boleh fokus pada free-form text dalam jendela 24 jam.

Namun siapkan abstraction:

```ts
type SendWhatsappMessageInput =
  | {
      type: "text";
      text: string;
      replyToProviderWamid?: string;
    }
  | {
      type: "template";
      templateName: string;
      languageCode: string;
      components?: unknown[];
    };
```

Di luar jendela 24 jam:

- tampilkan template picker;
- fetch template melalui server;
- hanya tampilkan template yang statusnya dapat digunakan;
- jangan mengirim template dari browser langsung ke provider.

Apabila template belum dikerjakan pada iterasi ini, tampilkan disabled action dengan penjelasan dan dokumentasikan sebagai phase 2. Jangan mengirim free-form text secara diam-diam.

---

## 20. Attachment dan media

Attachment dapat menjadi phase 2 apabila scope perlu dibatasi.

Tetap siapkan model dan UI placeholder untuk:

- image;
- video;
- audio;
- document.

Ketika media diimplementasikan:

- upload hanya melalui server atau signed upload yang aman;
- validasi MIME, ukuran, dan ekstensi;
- jangan percaya filename user;
- jangan membocorkan URL internal;
- gunakan proxy/download route jika provider media URL membutuhkan auth;
- cegah path traversal;
- tampilkan fallback apabila media expired.

---

## 21. Error handling

Buat error domain terstruktur:

```ts
type WhatsappErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFIGURATION_MISSING"
  | "CONVERSATION_NOT_FOUND"
  | "SERVICE_WINDOW_CLOSED"
  | "INVALID_MESSAGE"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_REJECTED"
  | "PROVIDER_UNAVAILABLE"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "DATABASE_ERROR"
  | "UNKNOWN";
```

API internal tidak boleh mengembalikan raw error provider secara penuh kepada browser.

Simpan informasi troubleshooting yang aman:

- provider request ID;
- status HTTP;
- error code provider;
- timestamp;
- conversation ID internal.

Redact PII pada log bila sistem logging mendukungnya.

---

## 22. Testing wajib

### Unit test

Buat test untuk:

- signature verifier;
- event normalizer;
- mapper contact;
- mapper conversation;
- mapper message;
- message status monotonic;
- `needs_reply`;
- service window;
- send input validation;
- idempotency key;
- dedupe webhook.

### Integration test

Buat test untuk:

- API list conversations terikat tenant;
- user tanpa permission ditolak;
- send message membuat local pending row;
- provider failure mengubah status failed;
- webhook event yang sama dua kali hanya membuat satu message;
- status event out-of-order tidak menurunkan status;
- mark read reset unread;
- update assignment tidak dapat memakai user tenant lain.

### Fixture webhook

Tambahkan fixture yang mewakili:

- inbound text;
- inbound media;
- outbound sent;
- delivered;
- read;
- failed;
- edited;
- revoked;
- contact updated;
- conversation closed.

Fixture tidak boleh memuat nomor atau secret production.

### E2E minimum

1. Login sebagai admin.
2. Menu WhatsApp Inbox terlihat.
3. Buka inbox.
4. Pilih conversation.
5. Timeline tampil.
6. Kirim pesan.
7. Bubble pending menjadi sent.
8. Simulasikan webhook delivered/read.
9. Status berubah.
10. Simulasikan inbound.
11. Pesan muncul tanpa reload.
12. Unread berubah.
13. Buka conversation dan mark read.
14. Filter `belum dibalas` bekerja.
15. User tanpa permission tidak dapat membuka route.

---

## 23. Performance

- Gunakan cursor pagination.
- Jangan fetch semua conversation sekaligus.
- Jangan fetch seluruh message history sekaligus.
- Gunakan lazy load/infinite scroll.
- Hindari N+1 query.
- Gunakan index yang tepat.
- Conversation list default 30–50 item.
- Messages default 30–50 item.
- Gunakan virtualization jika list besar dan library sudah tersedia.
- Debounce search.
- Jangan subscribe realtime ke seluruh tenant jika filter dapat dipersempit.
- Batasi raw payload yang dikirim ke browser.

---

## 24. Monitoring dan operasional

Tambahkan logging terstruktur untuk:

- webhook received;
- webhook duplicate;
- webhook failed;
- sync started/completed/failed;
- provider request failed;
- send failed;
- mark-read failed.

Tambahkan halaman/status kecil atau dokumentasi query untuk memeriksa:

- waktu webhook terakhir;
- event gagal;
- sync terakhir;
- message failed;
- account configuration.

Jangan membuat cron baru apabila platform saat ini belum memiliki pola cron. Dokumentasikan kebutuhan reconciliation job.

---

## 25. Urutan implementasi

Kerjakan berurutan.

### Phase 1 — Audit

- Audit repository.
- Tulis `docs/whatsapp-inbox-audit.md`.
- Tentukan route, schema relation, dan permission.
- Laporkan blocker nyata sebelum perubahan besar.

### Phase 2 — Database

- Buat migration.
- Tambahkan enum/check/index.
- Tambahkan RLS.
- Generate/update Supabase types sesuai workflow proyek.
- Jalankan migration/test lokal bila environment tersedia.

### Phase 3 — Provider layer

- Kirimdev server client.
- Type/schema.
- Error mapping.
- Signature verifier.
- Unit test.

### Phase 4 — Webhook

- Public verified route.
- Dedupe.
- Normalizer.
- Event processor.
- Fixtures dan tests.

### Phase 5 — Sync

- Account discovery.
- Conversation backfill.
- Lazy message backfill.
- Cursor state.
- Manual admin sync/script.

### Phase 6 — Internal API

- Conversations.
- Message history.
- Send.
- Mark read.
- Update status/priority/assignment.
- Labels.
- Quick replies.
- Templates abstraction.

### Phase 7 — UI

- Menu.
- Route.
- Three-panel inbox.
- Responsive behavior.
- Search/filter.
- Composer.
- Status and error states.

### Phase 8 — Realtime

- Supabase subscriptions.
- Cache reconciliation.
- Optimistic dedupe.

### Phase 9 — Quality

- Typecheck.
- Lint.
- Unit test.
- Integration test.
- E2E jika tersedia.
- Accessibility pass.
- Performance pass.

### Phase 10 — Documentation

Buat:

```text
docs/whatsapp-inbox-setup.md
```

Isi:

- env variables;
- migration command;
- webhook URL;
- cara membuat subscription;
- event yang harus dipilih;
- cara menyimpan initial secret;
- initial sync;
- testing lokal;
- deployment;
- troubleshooting;
- cara rotasi webhook secret;
- cara rollback.

---

## 26. Acceptance criteria

Implementasi dinyatakan selesai hanya apabila seluruh item berikut terpenuhi.

### Navigasi dan akses

- [ ] Menu WhatsApp Inbox terpasang pada dashboard lama.
- [ ] Route dilindungi auth.
- [ ] Route dilindungi permission.
- [ ] Tidak ada akses lintas tenant.

### Data

- [ ] Account tersimpan.
- [ ] Contact tersimpan.
- [ ] Conversation tersimpan.
- [ ] Message tersimpan.
- [ ] Unique constraint mencegah duplikasi.
- [ ] RLS aktif.
- [ ] Index utama tersedia.

### Inbox

- [ ] Conversation list tampil.
- [ ] Cursor pagination bekerja.
- [ ] Search bekerja.
- [ ] Filter status bekerja.
- [ ] Filter unread bekerja.
- [ ] Filter needs reply bekerja.
- [ ] Filter assignee bekerja.
- [ ] Filter priority bekerja.
- [ ] Filter label bekerja.

### Chat

- [ ] Timeline tampil.
- [ ] Infinite scroll message bekerja.
- [ ] Kirim text bekerja.
- [ ] Optimistic state bekerja.
- [ ] Retry failed message tidak menduplikasi kiriman.
- [ ] Status sent/delivered/read/failed tampil.
- [ ] Mark-as-read bekerja.
- [ ] Reply-to minimal terstruktur.
- [ ] Window 24 jam ditampilkan.

### Webhook

- [ ] Raw body digunakan.
- [ ] HMAC diverifikasi.
- [ ] Timestamp tolerance diterapkan.
- [ ] Multiple secrets didukung.
- [ ] Event ID dideduplikasi.
- [ ] Duplicate event aman.
- [ ] Message inbound real-time.
- [ ] Status update real-time.
- [ ] Failed event tercatat.

### UI

- [ ] Desktop tiga panel.
- [ ] Mobile usable.
- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Keyboard composer.
- [ ] Dark/light theme mengikuti aplikasi.
- [ ] Tidak menyalin branding Kirimdev.

### Security

- [ ] API key tidak ada di client bundle.
- [ ] Webhook secret tidak ada di client bundle.
- [ ] Service role tidak ada di browser.
- [ ] Input divalidasi.
- [ ] Query terikat tenant.
- [ ] Log tidak membocorkan secret.
- [ ] Permission dicek pada server, bukan hanya UI.

### Quality

- [ ] TypeScript lulus.
- [ ] Lint lulus.
- [ ] Unit test lulus.
- [ ] Integration test utama lulus.
- [ ] Tidak ada mock data tersisa.
- [ ] Dokumentasi setup tersedia.

---

## 27. Hal yang tidak perlu dikerjakan pada MVP kecuali mudah

Jangan memperbesar scope tanpa alasan.

Boleh menjadi phase 2:

- broadcast;
- chatbot AI;
- automation workflow;
- analytics kompleks;
- SLA dashboard;
- voice call;
- campaign manager;
- bulk send;
- attachment upload lengkap;
- emoji picker khusus;
- typing indicator antar-agent;
- presence kompleks;
- merge contact;
- export chat;
- advanced full-text ranking;
- multi-number account switcher apabila saat ini hanya ada satu nomor.

Tetap siapkan struktur agar fitur tersebut dapat ditambahkan tanpa menulis ulang seluruh modul.

---

## 28. Larangan implementasi

Jangan:

- memanggil Kirimdev dari browser;
- menyimpan secret di localStorage;
- membuat semua tabel dapat dibaca semua authenticated user;
- menggunakan polling setiap satu detik;
- menjalankan full sync pada setiap page load;
- mengirim seluruh raw webhook payload ke browser;
- menggunakan offset pagination untuk message history besar;
- mengandalkan nama contact sebagai unique key;
- mengandalkan nomor telepon saja karena provider dapat memakai BSUID;
- membuat duplikasi message saat optimistic state bertemu webhook;
- menurunkan status message akibat event out-of-order;
- membuat webhook subscription setiap aplikasi restart;
- mengabaikan window WhatsApp 24 jam;
- menganggap response provider selalu sama tanpa schema/guard;
- menyelesaikan task dengan UI statis atau dummy data.

---

## 29. Format laporan akhir Codex

Setelah implementasi, berikan laporan dengan struktur berikut:

```md
## Ringkasan
Apa yang berhasil dibuat.

## Hasil audit
Stack dan pola proyek yang dipakai.

## File yang ditambahkan
Daftar file baru dan fungsi utamanya.

## File yang diubah
Daftar file lama yang diubah dan alasan.

## Database
Migration, tabel, index, RLS, dan command yang perlu dijalankan.

## Environment variables
Nama env yang wajib diisi tanpa menampilkan nilainya.

## Kirimdev setup
Webhook URL, event subscription, initial sync, dan secret handling.

## Testing
Command yang dijalankan dan hasil sebenarnya.

## Manual verification
Langkah pengujian dari dashboard.

## Known limitations
Fitur yang sengaja menjadi phase 2 atau hal yang belum dapat diverifikasi.

## Risiko/rollback
Cara menonaktifkan modul atau rollback migration dengan aman.
```

Jangan mengklaim test lulus jika test tidak dijalankan.

---

## 30. Instruksi mulai untuk Codex

Mulai dengan langkah berikut:

1. Baca seluruh dokumen ini.
2. Audit repository.
3. Tulis `docs/whatsapp-inbox-audit.md`.
4. Tampilkan rencana implementasi berdasarkan struktur repository yang ditemukan.
5. Implementasikan secara bertahap.
6. Jalankan typecheck, lint, dan tests.
7. Buat `docs/whatsapp-inbox-setup.md`.
8. Berikan laporan akhir sesuai format pada bagian 29.

Prioritas utama:

```text
security
correctness
idempotency
tenant isolation
realtime consistency
maintainability
UI consistency
```

Jangan mengejar kemiripan visual dengan screenshot dengan mengorbankan keamanan atau arsitektur.
