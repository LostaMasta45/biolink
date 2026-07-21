import { z } from "zod";
import { PAYMENT_ADDONS, PAYMENT_PACKAGES } from "@/lib/payment-types";

const phoneDigits = (value: string) => value.replace(/\D/g, "");

export function normalizeIndonesianWhatsapp(value: string): string | null {
  const digits = phoneDigits(value);
  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits.startsWith("62")
      ? digits
      : `62${digits}`;

  return /^628\d{7,12}$/.test(normalized) ? normalized : null;
}

export const createPaymentSchema = z.object({
  customer_name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Nama terlalu panjang"),
  customer_whatsapp: z.string().trim().min(8, "Nomor WhatsApp wajib diisi").max(24, "Nomor WhatsApp tidak valid"),
  customer_company: z.string().trim().min(2, "Nama perusahaan minimal 2 karakter").max(150, "Nama perusahaan terlalu panjang"),
  package_id: z.coerce.number().int().positive(),
  addons: z.array(z.coerce.number().int().positive()).max(8).default([]),
  idempotency_key: z.string().uuid("Sesi pembayaran tidak valid"),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export type PaymentLineItem = {
  code: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  kind: "package" | "addon";
};

export function buildPaymentSnapshot(packageId: number, addonIds: number[]) {
  const selectedPackage = PAYMENT_PACKAGES.find((item) => item.id === packageId);
  if (!selectedPackage) throw new Error("Paket tidak ditemukan");

  const uniqueAddonIds = [...new Set(addonIds)];
  const selectedAddons = PAYMENT_ADDONS.filter((item) => uniqueAddonIds.includes(item.id));
  if (selectedAddons.length !== uniqueAddonIds.length) throw new Error("Salah satu add-on tidak ditemukan");

  const lineItems: PaymentLineItem[] = [
    {
      code: `package:${selectedPackage.id}`,
      name: selectedPackage.name,
      quantity: 1,
      unit_price: selectedPackage.price,
      subtotal: selectedPackage.price,
      kind: "package",
    },
    ...selectedAddons.map((addon) => ({
      code: `addon:${addon.id}`,
      name: addon.name,
      quantity: 1,
      unit_price: addon.price,
      subtotal: addon.price,
      kind: "addon" as const,
    })),
  ];

  return {
    selectedPackage,
    selectedAddons,
    lineItems,
    catalogSubtotal: lineItems.reduce((sum, item) => sum + item.subtotal, 0),
  };
}

export function getPaymentOrderId() {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `ILJ-${dateParts}-${random}`;
}
