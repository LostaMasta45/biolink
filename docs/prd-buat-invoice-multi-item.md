# PRD — Command WhatsApp `!buat_invoice` Multi Item

## 1. Tujuan

Meningkatkan command WhatsApp `!buat_invoice` agar admin dapat membuat **invoice transaksi manual yang sudah lunas** dengan:

- satu atau beberapa paket utama;
- jumlah/kuantitas tiap paket (misalnya paket Feed + Story Rp90.000 sebanyak 7 kali);
- beberapa add-on berbeda (misalnya Desain, Pin 7 Hari, dan lainnya);
- total otomatis dari semua item;
- link bukti invoice yang bisa dibuka customer dan diunduh sebagai PDF/PNG.

Command ini **bukan** alur pembayaran QRIS. Invoice yang dibuat melalui command selalu berstatus **LUNAS** dan tidak membuat QRIS, reminder, atau masa kedaluwarsa pembayaran.

## 2. Masalah saat ini

Alur Invoice Lengkap hanya mendukung:

- satu layanan utama;
- satu add-on opsional;
- kuantitas selalu satu.

Contoh transaksi berikut belum dapat dicatat dengan benar:

| Item | Harga satuan | Qty | Subtotal |
| --- | ---: | ---: | ---: |
| Feed + Story | Rp90.000 | 7 | Rp630.000 |
| Paket Desain | Rp25.000 | 1 | Rp25.000 |
| Pin 7 Hari | Rp15.000 | 1 | Rp15.000 |
| **Total** |  |  | **Rp670.000** |

## 3. Pengguna

- **Admin utama / staf admin**: mengirim command di WhatsApp untuk mencatat transaksi manual.
- **Customer**: menerima link invoice lunas untuk melihat rincian dan mengunduh bukti.

## 4. Ruang lingkup versi pertama

### Termasuk

- Banyak item paket maupun add-on dalam satu invoice.
- Nama item, harga satuan, dan qty diisi admin.
- Perhitungan subtotal per item dan total invoice otomatis.
- Ringkasan sebelum invoice dibuat.
- Konfirmasi eksplisit `LANJUT` atau pembatalan `BATAL`.
- Penyimpanan setiap item sebagai baris terpisah di `invoice_items`.
- Status transaksi dan invoice otomatis `PAID`/`paid`.
- Pesan siap-forward berisi link invoice lunas.

### Tidak termasuk

- Membuat QRIS atau menerima pembayaran dari command ini.
- Penagihan otomatis/reminder.
- Edit invoice setelah dibuat lewat WhatsApp (tetap dapat dikerjakan dari dashboard jika diperlukan).
- Diskon dan PPN; keduanya dapat menjadi fase berikutnya setelah alur item stabil.

## 5. Konsep item

Tidak perlu memisahkan teknis antara “paket utama” dan “add-on” di data invoice. Keduanya disimpan sebagai **item invoice** dengan tiga data wajib:

| Data | Contoh | Aturan |
| --- | --- | --- |
| Nama item | `Feed + Story` | teks wajib |
| Harga satuan | `90000` | angka Rupiah, lebih dari 0 |
| Qty | `7` | bilangan bulat, minimal 1 |

`Subtotal item = harga satuan × qty`.

Admin dapat menandai item pertama sebagai paket utama dan item berikutnya sebagai add-on hanya untuk memudahkan bahasa percakapan bot. Di invoice, semuanya tetap tampil rapi dalam satu tabel.

## 6. Alur percakapan yang diusulkan

Gunakan pilihan **Invoice Lengkap** dari `!buat_invoice` untuk alur multi item. Alur Invoice Lowongan yang sederhana dapat tetap dipertahankan untuk transaksi satu item cepat.

### 6.1 Memulai

```text
Admin: !buat_invoice
Bot: [Invoice Lowongan] [Invoice Lengkap]
Admin: Invoice Lengkap
Bot: Masukkan nama PT / klien:
Admin: PT Maju Jaya
Bot: Masukkan nomor WA klien (628...):
Admin: 628123456789
```

### 6.2 Menambah paket/item pertama

```text
Bot: Nama paket atau layanan pertama:
Admin: Feed + Story
Bot: Harga satuan Feed + Story (angka saja):
Admin: 90000
Bot: Qty Feed + Story:
Admin: 7
Bot: Ditambahkan: Feed + Story — 7 × Rp90.000 = Rp630.000.
     Tambah item lain? [Tambah Paket] [Tambah Add-on] [Selesai]
```

### 6.3 Menambah beberapa add-on

```text
Admin: Tambah Add-on
Bot: Nama add-on:
Admin: Paket Desain
Bot: Harga satuan Paket Desain:
Admin: 25000
Bot: Qty Paket Desain:
Admin: 1
Bot: Ditambahkan: Paket Desain — 1 × Rp25.000 = Rp25.000.
     Tambah item lain? [Tambah Paket] [Tambah Add-on] [Selesai]

Admin: Tambah Add-on
Bot: Nama add-on:
Admin: Pin 7 Hari
Bot: Harga satuan Pin 7 Hari:
Admin: 15000
Bot: Qty Pin 7 Hari:
Admin: 1
Bot: Ditambahkan: Pin 7 Hari — 1 × Rp15.000 = Rp15.000.
     Tambah item lain? [Tambah Paket] [Tambah Add-on] [Selesai]
```

### 6.4 Ringkasan dan konfirmasi

Saat admin memilih `Selesai`, bot mengirim:

```text
📋 RINGKASAN INVOICE

Klien: PT Maju Jaya
WA: 628123456789

1. Feed + Story
   7 × Rp90.000 = Rp630.000
2. Paket Desain
   1 × Rp25.000 = Rp25.000
3. Pin 7 Hari
   1 × Rp15.000 = Rp15.000

TOTAL LUNAS: Rp670.000

[LANJUT BUAT INVOICE] [TAMBAH ITEM] [BATAL]
```

- `LANJUT BUAT INVOICE`: menyimpan invoice dan transaksi sebagai lunas.
- `TAMBAH ITEM`: kembali ke pilihan Tambah Paket / Tambah Add-on.
- `BATAL`: menghapus sesi tanpa membuat data apa pun.

## 7. Perilaku setelah konfirmasi

Saat admin memilih `LANJUT BUAT INVOICE`:

1. Sistem membuat `order_id` dengan format yang sudah dipakai, misalnya `INV-123456`.
2. Sistem membuat satu transaksi di `payment_orders`:
   - `status = PAID`
   - `paid_at = waktu saat invoice dibuat`
   - `total_amount = total seluruh item`
3. Sistem membuat satu invoice dashboard di `invoices`:
   - `status = paid`
   - `subtotal = total seluruh item`
   - `total = total seluruh item`
4. Sistem membuat satu baris `invoice_items` untuk setiap paket dan add-on.
5. Bot mengirim ringkasan berhasil serta pesan siap-forward ke customer:

```text
Halo Kak [nama] 👋

Pembayaran sebesar Rp670.000 telah kami terima (LUNAS).
Bukti invoice dapat dibuka dan diunduh di tombol/link berikut.
```

6. Link bukti invoice: `https://infolokerjombang.net/pay/INV-123456`.

## 8. Data sesi WhatsApp

Data sementara di `bot_sessions.data` perlu diubah dari satu `amount` dan satu `addons` menjadi array `items`.

Contoh:

```json
{
  "type": "umum",
  "customer_name": "PT Maju Jaya",
  "wa": "628123456789",
  "items": [
    { "kind": "package", "name": "Feed + Story", "unit_price": 90000, "quantity": 7 },
    { "kind": "addon", "name": "Paket Desain", "unit_price": 25000, "quantity": 1 },
    { "kind": "addon", "name": "Pin 7 Hari", "unit_price": 15000, "quantity": 1 }
  ]
}
```

Aturan hitung:

```text
item_total = unit_price × quantity
invoice_total = jumlah seluruh item_total
```

## 9. Validasi wajib

- Nomor WA hanya angka dan minimal format Indonesia `628...`.
- Harga hanya angka positif; input seperti `Rp90.000` dinormalisasi menjadi `90000`.
- Qty hanya bilangan bulat positif, minimal 1.
- Nama item tidak boleh kosong.
- Maksimal sementara: 20 item per invoice agar percakapan dan tampilan invoice tetap nyaman.
- Tombol/teks `LANJUT` harus divalidasi secara ketat; teks lain tidak boleh membuat invoice.
- `BATAL` dapat dipakai di tahap mana saja dan tidak menyimpan invoice/transaksi.

## 10. Dampak pada tampilan invoice

Tidak perlu mengubah desain invoice. Tabel yang sudah ada cukup menampilkan banyak baris:

| Deskripsi | Qty | Harga | Total |
| --- | ---: | ---: | ---: |
| Feed + Story | 7 | Rp90.000 | Rp630.000 |
| Paket Desain | 1 | Rp25.000 | Rp25.000 |
| Pin 7 Hari | 1 | Rp15.000 | Rp15.000 |

Total invoice tetap dihitung dari seluruh baris item. PDF dan PNG mengikuti tabel yang sama.

## 11. Kriteria selesai / acceptance criteria

1. Admin dapat menambahkan minimal tiga item dalam satu invoice.
2. Sistem menghitung qty × harga satuan untuk setiap item dengan benar.
3. Sistem menjumlahkan seluruh item dengan benar.
4. Invoice dashboard memiliki seluruh baris `invoice_items`.
5. Link invoice publik menampilkan seluruh item, qty, subtotal, dan total yang sama.
6. PDF dan PNG memuat rincian yang sama dengan halaman invoice.
7. Invoice dibuat hanya setelah konfirmasi `LANJUT`.
8. `BATAL` tidak membuat transaksi, invoice, atau pesan customer.
9. Tidak ada QRIS atau reminder yang dibuat oleh `!buat_invoice`.

## 12. Fase lanjutan (di luar versi pertama)

- Diskon nominal atau persen per invoice.
- PPN/pajak.
- Tanggal pembayaran manual yang dapat dipilih.
- Pengiriman WA otomatis langsung ke customer memakai tombol URL, dengan pemeriksaan aturan 24 jam.
- Pilihan dari katalog paket/add-on agar admin tidak perlu mengetik harga berulang kali.
- Edit atau hapus item sebelum konfirmasi melalui tombol.

## 13. Status implementasi

Versi pertama sudah aktif di production `infolokerjombang.net`.

- `Invoice Lowongan` lama tetap berjalan untuk transaksi satu item cepat.
- `Invoice Lengkap` kini memakai item berulang: pilih `PAKET` atau `ADDON`, isi nama, harga, dan qty.
- Setelah setiap item, tersedia tombol `Tambah Paket`, `Tambah Add-on`, atau `Selesai`.
- Ringkasan menghitung subtotal setiap item dan total seluruh invoice.
- Invoice hanya dibuat setelah `LANJUT`; `BATAL` menghapus sesi tanpa menyimpan transaksi.
- Setiap baris item disimpan ke `invoice_items`; transaksi dan invoice berstatus lunas.
- Link invoice tetap berbentuk `/pay/INV-...` dan tidak membuat QRIS.

### Cara uji admin

1. Kirim `!buat_invoice`.
2. Pilih **Invoice Lengkap**.
3. Isi nama dan WA customer.
4. Pilih `PAKET`, lalu masukkan `Feed + Story`, `90000`, dan `7`.
5. Pilih `Tambah Add-on`, masukkan `Paket Desain`, `25000`, dan `1`.
6. Pilih `Tambah Add-on`, masukkan `Pin 7 Hari`, `15000`, dan `1`.
7. Pilih `Selesai`, cek total **Rp670.000**, lalu pilih `Lanjut Buat Invoice`.
8. Buka link `/pay/INV-...` dan pastikan tiga baris item serta totalnya tampil.
