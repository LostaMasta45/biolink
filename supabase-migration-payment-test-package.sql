-- Paket uji coba QRIS menggunakan ID 99. Baris internal ini menjaga foreign key
-- posting_queue tetap valid tanpa menampilkan paket uji coba sebagai produk aktif.
INSERT INTO posting_packages (id, name, price, description, is_popular, is_active)
VALUES (99, 'Paket Uji Coba (Test)', 1000, 'Paket internal untuk pengujian alur pembayaran QRIS.', FALSE, FALSE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  is_popular = FALSE,
  is_active = FALSE;
