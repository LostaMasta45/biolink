# Panduan Operasional Auto Reply untuk Customer Service

Dokumen ini menjadi catatan utama untuk pengoperasian, pengujian, troubleshooting, dan pengembangan lanjutan Auto Reply WhatsApp Infolokerjombang.

> Update 16 Juli 2026: Prioritas 1–6 telah diimplementasikan. Detail teknis, migration, audit log, dan tutorial terbaru tersedia di [Implementasi Automation v2 dan Audit Log WhatsApp](./16-implementation-automation-v2-dan-audit-log.md).

## Status implementasi

Pada 16 Juli 2026, alur berikut telah diuji secara nyata dan berhasil:

```text
Customer mengirim keyword
        ↓
KirimDev mengirim message.received
        ↓
Webhook membaca rule Auto Reply di Supabase
        ↓
Keyword dicocokkan
        ↓
Template copywriting dipilih
        ↓
Admin Utama mengirim balasan melalui KirimDev
        ↓
Activity log tercatat success
```

Pengujian terakhir menggunakan keyword `hayolo` dan template `nyoba`. Endpoint mengembalikan `auto_reply_sent` dan tabel `logs` mencatat status `success`.

## Catatan penting dari insiden dua hari

Webhook yang sehat dan test kirim manual yang berhasil belum membuktikan Auto Reply bekerja. Pada insiden sebelumnya, KirimDev dan webhook sebenarnya sudah aktif, tetapi execution engine tidak dapat membaca rule.

Penyebab yang ditemukan:

1. `SUPABASE_SERVICE_ROLE_KEY` belum tersedia sehingga proses webhook memakai anon key.
2. RLS Supabase menyembunyikan tabel `auto_reply` dari anon key. Query tidak selalu terlihat sebagai error; hasilnya dapat tampak seperti daftar rule kosong.
3. Form pernah mengirim field `match_type`, tetapi migration database belum membuat kolom tersebut.
4. Error database dan pengiriman ditelan sehingga endpoint tetap tampak sukses.
5. Event `message.sent` belum dipisahkan tegas dari `message.received`, sehingga berisiko memproses pesan outbound sebagai pesan customer.
6. Kontrak tombol KirimDev menggunakan `interactive.type = "reply_buttons"`. Nilai yang berbeda menghasilkan `invalid_field_value`.
7. ID tombol harus mengambil `buttons[].id` yang tersimpan di template, bukan label tombol.

Kesimpulan operasional: pemeriksaan harus selalu mencakup empat lapisan—webhook masuk, rule terbaca, request KirimDev diterima, dan activity log sukses.

## Environment variable wajib

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

KIRIMDEV_API_KEY=kdv_live_...
KIRIMDEV_PHONE_ID=PHONE_ID_ADMIN_UTAMA
KIRIMDEV_PHONE_NUMBER_1=628xxxxxxxxxx
KIRIMDEV_WEBHOOK_SECRET=whsec_...
```

Nama `SUPABASE_SERVICE_ROLE_KEY` harus sama persis. Kesalahan seperti `SUPABASE_SERVICE_ROLE_KE` membuat aplikasi kembali memakai anon key.

Ketentuan keamanan:

- Jangan menambahkan prefix `NEXT_PUBLIC_` pada service-role key.
- Jangan commit `.env.local`.
- Setelah mengubah environment, restart server lokal atau redeploy aplikasi.
- Rotasi key jika pernah tampil pada log, screenshot, chat publik, atau repository.

## Cara membuat Auto Reply untuk CS

### 1. Buat template copywriting

Masuk ke **WhatsApp → Templates**, lalu buat template. Untuk tahap awal, gunakan tipe **Teks** karena paling mudah diuji.

Contoh:

```text
Nama: cs_pricelist
Kategori: Customer Service
Tipe: Teks

Body:
Halo Kak 👋

Berikut informasi paket publikasi Infolokerjombang. Tim kami siap membantu Kakak memilih paket yang paling sesuai.
```

Pastikan status template aktif.

### 2. Buat keyword

Masuk ke **WhatsApp → Auto Reply**, lalu pilih **Balasan Baru**.

```text
Keyword: pricelist
Template: cs_pricelist
Status: Aktif
```

Implementasi saat ini menggunakan pencocokan persis yang tidak sensitif terhadap huruf besar/kecil dan spasi berlebih:

| Pesan customer | Hasil untuk keyword `pricelist` |
|---|---|
| `pricelist` | Cocok |
| `PRICELIST` | Cocok |
| `  pricelist  ` | Cocok |
| `minta pricelist` | Tidak cocok |
| `pricelist kak` | Tidak cocok |

Pencocokan persis dipilih sebagai default agar CS tidak mengirim jawaban yang salah hanya karena suatu kata muncul dalam kalimat customer.

## Tutorial menguji Auto Reply

### Tes 1 — pemeriksaan konfigurasi dashboard

1. Masuk ke **WhatsApp → Overview**.
2. Klik **Test API** dan pastikan koneksi KirimDev aktif.
3. Klik **Periksa Auto Reply**.
4. Pastikan jumlah rule aktif dengan template aktif lebih dari nol.

Tes ini tidak mengirim WhatsApp. Tujuannya hanya memvalidasi konfigurasi.

### Tes 2 — pengujian nyata dari WhatsApp

1. Gunakan nomor WhatsApp customer/test yang dapat menerima balasan.
2. Kirim keyword persis, misalnya `pricelist`, ke nomor WhatsApp bisnis yang terhubung ke webhook.
3. Tunggu balasan dari nomor Admin Utama.
4. Buka **WhatsApp → Webhook** dan pastikan ada event `message.received`.
5. Buka **WhatsApp → Logs** dan pastikan terdapat:

```text
event_type: auto_reply_triggered
status: success
keyword: pricelist
```

6. Bila KirimDev mengembalikan status `pending`, periksa event `message.status` untuk hasil `sent`, `delivered`, `read`, atau `failed`.

### Tes 3 — variasi normalisasi

Kirim secara bergantian:

```text
pricelist
PRICELIST
  pricelist  
PriCeLiSt
```

Keempatnya harus memicu template yang sama.

### Tes 4 — negative test

Kirim pesan yang tidak boleh cocok:

```text
minta pricelist
pricelist kak
harga pricelist
```

Pastikan tidak ada balasan otomatis. Negative test penting untuk mencegah jawaban CS yang salah konteks.

### Tes 5 — template tombol

1. Buat template tipe **Tombol Balasan**.
2. Gunakan maksimum tiga tombol.
3. Pastikan setiap label tombol maksimal 20 karakter.
4. Hubungkan template tersebut dengan keyword test.
5. Kirim keyword dari WhatsApp customer.
6. Pastikan pesan dan tombol muncul serta dapat ditekan.

Untuk KirimDev, payload tombol yang valid menggunakan:

```json
{
  "type": "interactive",
  "interactive": {
    "type": "reply_buttons",
    "body": { "text": "Isi pesan" },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": {
            "id": "paket_feed",
            "title": "Feed"
          }
        }
      ]
    }
  }
}
```

## Ide pengembangan automation

### Prioritas 1 — tipe pencocokan

Tambahkan pilihan berikut per rule:

| Tipe | Contoh keyword | Pesan | Hasil |
|---|---|---|---|
| `equals` | `harga` | `harga` | Cocok |
| `contains` | `harga` | `boleh minta harga kak` | Cocok |
| `starts_with` | `order` | `order paket feed` | Cocok |

Rekomendasi:

- Gunakan `equals` untuk menu dan command yang harus pasti.
- Gunakan `contains` hanya untuk kata yang unik dan tidak ambigu.
- Gunakan `starts_with` untuk command yang memiliki parameter.
- Default tetap `equals`.

Field baru harus dibuat melalui migration database sebelum form dashboard mengirimkannya. Jangan mengulangi masalah schema UI dan database yang tidak sinkron.

Usulan kolom:

```sql
ALTER TABLE auto_reply
ADD COLUMN IF NOT EXISTS match_type TEXT NOT NULL DEFAULT 'equals'
CHECK (match_type IN ('equals', 'contains', 'starts_with'));
```

### Prioritas 2 — jeda pengiriman

Tambahkan `delay_seconds` agar balasan terasa lebih natural dan memberi waktu bila beberapa pesan harus dikirim berurutan.

Rekomendasi operasional:

| Jenis pesan | Delay yang disarankan |
|---|---:|
| Sapaan sederhana | 1–2 detik |
| Copywriting panjang | 2–4 detik |
| Pesan kedua dalam rangkaian | 3–6 detik |
| Pesan berisi dokumen/media | 2–5 detik |

Jangan menjalankan `sleep` di dalam request webhook. Pada deployment serverless, proses dapat dihentikan sebelum delay selesai. Gunakan job queue yang persisten:

```text
Webhook menerima pesan
        ↓
Validasi dan cocokkan rule
        ↓
Simpan auto_reply_jobs dengan scheduled_at
        ↓
Worker/cron mengambil job yang sudah jatuh tempo
        ↓
Kirim melalui KirimDev
        ↓
Simpan success/failed dan retry
```

Usulan kolom rule:

```sql
ALTER TABLE auto_reply
ADD COLUMN IF NOT EXISTS delay_seconds INTEGER NOT NULL DEFAULT 0
CHECK (delay_seconds BETWEEN 0 AND 30);
```

### Prioritas 3 — cooldown dan anti-spam

Customer dapat mengirim keyword yang sama berkali-kali. Tambahkan cooldown per nomor customer dan rule.

Rekomendasi awal:

- Cooldown default: 60 detik.
- Abaikan event webhook duplikat berdasarkan `X-Kirim-Event-Id`.
- Maksimal satu balasan rule yang sama selama cooldown.
- Catat hasil sebagai `skipped_cooldown`, bukan `failed`.

### Prioritas 4 — prioritas rule

Bila `contains` ditambahkan, beberapa rule dapat cocok sekaligus. Tambahkan `priority` dan selalu jalankan satu rule prioritas tertinggi.

Contoh:

```text
Priority 100: "komplain pembayaran"
Priority 50 : "pembayaran"
Priority 10 : "harga"
```

Urutan evaluasi yang disarankan:

1. `equals`
2. `starts_with`
3. `contains`
4. Nilai `priority` tertinggi
5. Rule yang dibuat lebih dahulu sebagai tie-breaker

### Prioritas 5 — jam operasional dan handover CS

Tambahkan dua respons berbeda:

- Jam operasional: informasikan CS akan segera menangani.
- Di luar jam operasional: informasikan jam buka dan estimasi balasan.

Tambahkan keyword handover seperti `admin`, `cs`, atau `bantuan` untuk menghentikan automation dan menyerahkan percakapan ke manusia.

### Prioritas 6 — test mode

Tambahkan mode test dengan allowlist nomor internal:

```text
is_test_mode = true
test_phone_numbers = [nomor owner, nomor CS]
```

Saat test mode aktif, rule hanya merespons nomor allowlist. Fitur ini membuat tim CS dapat menguji copywriting tanpa mengenai customer nyata.

## Rekomendasi keyword untuk customer service

| Keyword | Template | Tujuan |
|---|---|---|
| `halo` | `cs_welcome` | Sapaan dan menu awal |
| `pricelist` | `cs_pricelist` | Informasi harga/paket |
| `cara order` | `cs_cara_order` | Panduan pemesanan |
| `pembayaran` | `cs_pembayaran` | Metode pembayaran |
| `status` | `cs_status_order` | Panduan pengecekan status |
| `revisi` | `cs_revisi` | Ketentuan revisi poster |
| `jadwal` | `cs_jadwal_tayang` | Informasi jadwal publikasi |
| `admin` | `cs_handover` | Serahkan ke CS manusia |

Mulai dengan jumlah keyword kecil. Sepuluh rule yang teruji lebih berguna daripada seratus rule yang saling bertabrakan.

## Troubleshooting cepat

| Gejala | Pemeriksaan | Solusi |
|---|---|---|
| Webhook masuk tetapi tidak ada balasan | Periksa `SUPABASE_SERVICE_ROLE_KEY` dan rule aktif | Betulkan nama env, restart/redeploy |
| Dashboard menampilkan rule tetapi engine melihat 0 rule | RLS atau service-role tidak terbaca | Gunakan service-role server-only atau jalankan migration policy webhook |
| `invalid_field_value` pada tombol | Periksa `interactive.type` | Gunakan `reply_buttons` |
| Keyword tidak cocok | Bandingkan pesan setelah trim/lowercase | Uji dengan keyword persis |
| Template tidak terkirim | Periksa template aktif dan data wajib | Aktifkan template dan lengkapi body/tombol/media |
| Webhook berulang | Periksa event type dan event ID | Proses hanya `message.received`, tambahkan deduplication |
| Log tidak tersimpan | Service-role tidak tersedia | Pastikan nama env benar dan restart server |
| Test dashboard sukses tetapi WA tidak masuk | Test dashboard hanya cek konfigurasi | Lakukan pengujian nyata dari WhatsApp dan cek status KirimDev |

## Checklist sebelum dipakai CS

- [ ] Environment variable sudah benar dan server telah direstart.
- [ ] Test API KirimDev berhasil.
- [ ] Webhook menerima `message.received`.
- [ ] Template aktif dan copywriting telah disetujui tim CS.
- [ ] Keyword aktif dan tidak tumpang tindih.
- [ ] Positive test berhasil.
- [ ] Negative test tidak menghasilkan balasan.
- [ ] Activity log mencatat `success`.
- [ ] Tombol/media diuji pada perangkat WhatsApp nyata.
- [ ] Tersedia keyword handover ke manusia.
- [ ] CS mengetahui cara mematikan rule bermasalah dengan switch status aktif.

## Urutan implementasi lanjutan yang disarankan

1. Pertahankan versi sekarang sebagai baseline stabil.
2. Tambahkan `match_type` melalui migration, backend, kemudian UI.
3. Tambahkan cooldown dan deduplication sebelum memperluas penggunaan `contains`.
4. Tambahkan job queue untuk delay dan retry.
5. Tambahkan jam operasional dan handover manusia.
6. Tambahkan halaman simulasi/test mode untuk CS.

Setiap tahap harus memiliki migration, validasi backend, form UI, log, positive test, dan negative test sebelum dipakai customer.
