# Form Pesan KirimDev dan Meta

Dokumen ini mencatat desain form **Pesan Tersimpan** yang dipakai Auto Reply. Implementasi mengikuti kontrak resmi `POST /v1/{phone_number_id}/messages` milik KirimDev dan struktur WhatsApp Cloud API milik Meta.

## Perbedaan pesan sesi dan template Meta

Menu ini menyimpan pesan sesi untuk membalas customer yang telah menghubungi bisnis. Menu ini bukan editor untuk membuat template Meta-approved kategori Marketing, Utility, atau Authentication.

Untuk auto reply, customer memulai percakapan melalui keyword sehingga pesan teks/media/interaktif dapat dipakai dalam customer service window yang berlaku. Pengiriman di luar window memerlukan template Meta-approved yang dikelola dan disetujui secara terpisah.

## Matriks field resmi

| Tipe | Body/caption | Header | Footer | Action/field khusus |
|---|---|---|---|---|
| Text | Wajib, maks. 4096 | Tidak ada | Tidak ada | `preview_url` opsional |
| Image | Caption opsional, maks. 1024 | Tidak ada | Tidak ada | URL gambar |
| Video | Caption opsional, maks. 1024 | Tidak ada | Tidak ada | URL video |
| Audio | Tidak ada caption | Tidak ada | Tidak ada | URL audio |
| Document | Caption opsional, maks. 1024 | Tidak ada | Tidak ada | URL dan filename opsional |
| Reply buttons | Body wajib, maks. 1024 | Teks/image/video/document opsional | Opsional, maks. 60 | 1–3 tombol; label maks. 20 |
| CTA URL | Body wajib, maks. 1024 | Teks/image/video/document opsional | Opsional, maks. 60 | Tepat 1 URL; label maks. 20 |
| List | Body wajib, maks. 1024 | Hanya teks opsional | Opsional, maks. 60 | Label action maks. 20; maks. 10 section |
| Carousel | Body global wajib, maks. 1024 | Tidak ada header global | Tidak ada footer global | 2–10 card, header card image/video |

Header dan footer tidak ditampilkan untuk tipe yang tidak menerimanya. Backend juga menghapus data field tersembunyi sebelum menyimpan sehingga nilai dari tipe sebelumnya tidak ikut dikirim.

## Batas list

- Judul section maksimal 24 karakter dan boleh kosong.
- ID row wajib, maksimal 200 karakter.
- Judul row wajib, maksimal 24 karakter.
- Deskripsi row maksimal 72 karakter.
- Minimal satu row per section.
- Maksimal 10 section pada form.

ID row dikirim kembali oleh webhook ketika customer memilih item. Gunakan ID stabil seperti `paket_feed`, bukan teks acak.

## Batas carousel

- Minimal 2 dan maksimal 10 card.
- Setiap card mempunyai header gambar atau video melalui URL publik.
- Isi card opsional, maksimal 160 karakter.
- Aksi card dapat berupa CTA URL atau quick reply.
- Label tombol maksimal 20 karakter.
- Quick reply membutuhkan ID stabil maksimal 256 karakter.

## Header media interaktif

Reply button dan CTA URL mendukung:

- teks maksimal 60 karakter;
- image melalui `image.link`;
- video melalui `video.link`;
- document melalui `document.link`.

List hanya mendukung header teks. Carousel menggunakan media pada setiap card, bukan header global.

## Mark message as read

`mark as read` bukan tipe template. Aksi ini membutuhkan Meta-native inbound message ID atau `wamid` dari webhook:

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid...."
}
```

Pengaturan tersedia di **WhatsApp → Settings → Pesan Masuk: Read Receipt**:

- **Otomatis tandai sudah dibaca** menjalankan read receipt setelah webhook disimpan.
- **Tampilkan indikator mengetik** menambahkan `typing_indicator: { "type": "text" }`.

Typing indicator dapat terlihat hingga sekitar 25 detik atau sampai pesan balasan dikirim. Jangan mengaktifkannya bila banyak pesan masuk tidak akan memperoleh balasan otomatis.

Log read receipt menggunakan event:

```text
Activity Log: api.message.read
Webhook Log : api.message.read / api.message.read_failed
Source      : webhook_auto_mark_read
```

Hanya pesan inbound dapat ditandai read. ID internal KirimDev `msg_*` atau pesan outbound tidak valid untuk operasi ini.

## Migration

Jalankan file berikut melalui Supabase SQL Editor sebelum deploy:

```text
supabase-migration-whatsapp-template-v3.sql
```

Migration menambahkan:

- tipe `audio`;
- `header_type`;
- `preview_url`;
- `filename`;
- `list_button_text`;
- `carousel_cards`;
- `auto_mark_read`;
- `show_typing_indicator`.

Migration aman dijalankan ulang dan mencoba mengonversi header data lama berdasarkan isi `header` serta ekstensi `media_url`.

## Tutorial pengujian

### Text

1. Pilih tipe Text.
2. Pastikan form tidak menampilkan header/footer.
3. Masukkan URL pada body dan aktifkan Preview tautan.
4. Simpan dan gunakan pada rule test mode.

Payload harus memiliki `type: text`, `text.body`, dan `text.preview_url` tanpa header/footer.

### Reply button dengan header gambar

1. Pilih Reply Button.
2. Pilih header Gambar.
3. Masukkan URL HTTPS gambar publik.
4. Isi body, footer opsional, dan 1–3 tombol.
5. Pastikan setiap ID tombol unik.

### List

1. Pilih List.
2. Periksa bahwa pilihan header hanya Tanpa Header atau Teks.
3. Isi label tombol pembuka.
4. Tambahkan section dan row lengkap dengan ID.
5. Kirim dan tekan satu row; webhook harus mengembalikan ID row tersebut.

### Carousel

1. Pilih Carousel; form otomatis membuat dua card.
2. Pilih gambar/video untuk setiap card.
3. Isi URL media, isi card, serta CTA/quick reply.
4. Pastikan tidak ada field header/footer global.

### Read receipt

1. Aktifkan Auto mark read di Settings.
2. Kirim pesan dari nomor test ke nomor bisnis.
3. Pastikan webhook membawa `messages[0].id` dengan prefix `wamid.`.
4. Periksa log `api.message.read` berstatus success.
5. Jangan menguji menggunakan pesan outbound.

## Sumber resmi

- [KirimDev: Send text](https://docs.kirimdev.com/sending/send-text/)
- [KirimDev: Receive messages](https://docs.kirimdev.com/sending/receive-messages/)
- [KirimDev OpenAPI](https://api.kirimdev.com/v1/openapi.json)
- [Meta WhatsApp Cloud API: Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- [Meta official Postman: Mark Message As Read](https://www.postman.com/meta/whatsapp-business-platform/request/k11hrcc/mark-message-as-read)
