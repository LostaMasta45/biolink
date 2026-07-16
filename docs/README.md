# WhatsApp Automation Manager

## Overview

WhatsApp Automation Manager adalah dashboard internal Infolokerjombang yang digunakan untuk mengelola seluruh konfigurasi WhatsApp Official melalui API dan Webhook Kirim.dev.

Dashboard ini BUKAN WhatsApp Gateway.

Dashboard ini hanya bertindak sebagai Control Panel.

Seluruh proses pengiriman pesan tetap dilakukan oleh Kirim.dev.

---

## Tujuan

Mempermudah admin mengelola:

- Flow Customer
- Template WhatsApp
- Automation
- Auto Reply
- Monitoring Webhook
- Monitoring Logs

tanpa perlu membuka Dashboard Kirim.dev setiap saat.

---

## Teknologi

- Next.js App Router
- TypeScript
- TailwindCSS
- shadcn/ui
- Supabase
- Kirim.dev API
- Payment Gateway

---

## Yang Tidak Dibuat

Dashboard ini TIDAK membuat ulang fitur Kirim.dev seperti:

- Chat Inbox
- Broadcast
- Contact
- Assignment
- Label
- Team Inbox

Karena semuanya sudah tersedia di Kirim.dev.

---

## Dokumentasi Implementasi

Walkthrough setup, route, penggunaan setiap modul, endpoint internal, dan hasil verifikasi tersedia di [13-implementation-walkthrough.md](./13-implementation-walkthrough.md).

Catatan insiden, tutorial pengujian, SOP customer service, troubleshooting, dan roadmap automation tersedia di [15-panduan-operasional-auto-reply-customer-service.md](./15-panduan-operasional-auto-reply-customer-service.md).

Implementasi prioritas 1–6, durable queue, audit log API/webhook, upgrade Overview, migration, dan prosedur tes dua nomor tersedia di [16-implementation-automation-v2-dan-audit-log.md](./16-implementation-automation-v2-dan-audit-log.md).

Matriks field pesan KirimDev/Meta, UX form per tipe, carousel, media header, read receipt, dan migration v3 tersedia di [17-template-message-kirimdev-meta.md](./17-template-message-kirimdev-meta.md).

Notification Center, copywriting event payment/invoice/poster, antrean notifikasi, routing Admin Utama/Bot, command menu, keamanan command, migration, dan tutorial tes tersedia di [18-notification-center-dan-admin-bot.md](./18-notification-center-dan-admin-bot.md).
