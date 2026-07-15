# API

Dashboard menggunakan API Kirim.dev.

Semua request dikirim melalui Backend.

Frontend tidak boleh langsung memanggil API Kirim.dev.

Flow

Frontend

-> Next.js API

-> Kirim.dev

-> Webhook

-> Backend

-> Supabase
