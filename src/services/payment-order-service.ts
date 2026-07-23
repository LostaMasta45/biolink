import { createClient } from "@supabase/supabase-js";
import { getTodayWIB, getTomorrowWIB } from "@/lib/utils";
import {
  buildPaymentSnapshot,
  getPaymentOrderId,
  normalizeIndonesianWhatsapp,
  type CreatePaymentInput,
  type PaymentLineItem,
} from "@/lib/payment-order";
import type { KlikQRISCreateResponse } from "@/lib/payment-types";
import { reportTelegramPaymentCancelled, reportTelegramTransactionCreated } from "@/services/telegram-admin-service";
import { emitInvoiceCreatedNotifications, schedulePendingPaymentReminder } from "@/services/whatsapp-notification-service";

type DatabaseRow = {
  id?: string;
  order_id: string;
  customer_name: string;
  customer_whatsapp: string;
  customer_company: string;
  package_id: number;
  package_name: string;
  addons?: number[];
  addon_names?: string[];
  amount: number;
  total_amount?: number | null;
  catalog_subtotal?: number | null;
  payable_amount?: number | null;
  price_snapshot?: PaymentLineItem[] | null;
  qris_url?: string | null;
  qris_image?: string | null;
  direct_url?: string | null;
  signature?: string | null;
  expired_at?: string | null;
  public_token?: string | null;
  upload_token?: string | null;
  related_invoice_id?: string | null;
  poster_status?: "pending" | "uploaded" | "deferred";
  status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED";
  paid_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
};

const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

function getPaymentAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) throw new Error("Konfigurasi Supabase belum lengkap");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false } });
}

function getPayableAmount(order: DatabaseRow, amountPaid?: number) {
  return Math.ceil(Number(amountPaid || order.payable_amount || order.total_amount || order.amount || 0));
}

// ID add-on di katalog pembayaran dan antrean posting memiliki sejarah yang
// berbeda. Simpan ID antrean yang benar agar tim operasional menerima layanan
// yang dibeli customer, bukan ID katalog mentah.
const PAYMENT_TO_POSTING_ADDON_ID: Record<number, number> = {
  1: 6, // Saluran WA/Threads/Telegram -> saluran distribusi
  2: 1, // Grup Facebook
  3: 2, // Pin 3 hari
  4: 3, // Pin 7 hari
  5: 4, // Sorotan
  6: 5, // Link swipe up
  7: 6, // Saluran IG
  8: 7, // Jasa desain
};

function toPostingAddonIds(addons: number[]): number[] {
  return [...new Set(addons.map((id) => PAYMENT_TO_POSTING_ADDON_ID[id]).filter((id): id is number => Boolean(id)))];
}

function asPaymentResponse(order: DatabaseRow) {
  return {
    order_id: order.order_id,
    status: order.status,
    amount: Number(order.catalog_subtotal || order.amount),
    total_amount: getPayableAmount(order),
    qris_url: order.qris_url || null,
    qris_image: order.qris_image || null,
    direct_url: order.direct_url || null,
    signature: order.signature || "",
    expired_at: order.expired_at,
    package_name: order.package_name,
    addon_names: order.addon_names || [],
    public_token: order.public_token || undefined,
    upload_token: order.upload_token || undefined,
    poster_status: order.poster_status || "pending",
    customer_name: order.customer_name,
    customer_whatsapp: order.customer_whatsapp,
    customer_company: order.customer_company,
    package_id: order.package_id,
    addons: order.addons || [],
  };
}

async function ensureInvoice(supabase: ReturnType<typeof getPaymentAdminClient>, order: DatabaseRow, status: "pending" | "paid") {
  const { data: existing, error: findError } = await supabase
    .from("invoices")
    .select("id, invoice_number")
    .eq("payment_order_id", order.order_id)
    .maybeSingle();
  if (findError) throw new Error(`Invoice tidak dapat dibaca: ${findError.message}`);

  if (existing) {
    if (status === "paid") {
      const { error } = await supabase.from("invoices").update({ status: "paid" }).eq("id", existing.id);
      if (error) throw new Error(`Status invoice tidak dapat diperbarui: ${error.message}`);
    }
    await supabase.from("payment_orders").update({ related_invoice_id: existing.id }).eq("order_id", order.order_id);
    return { invoice: existing, created: false };
  }

  const total = getPayableAmount(order);
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      payment_order_id: order.order_id,
      invoice_number: `INV-${order.order_id}`,
      client_name: order.customer_name,
      client_phone: order.customer_whatsapp,
      client_address: order.customer_company,
      sender_name: "InfoLokerJombang",
      sender_address: "Jombang, Jawa Timur",
      sender_contact: "@infolokerjombang",
      invoice_date: getTodayWIB(),
      subtotal: Number(order.catalog_subtotal || order.amount),
      discount_type: "nominal",
      discount_value: 0,
      discount_amount: 0,
      tax_enabled: false,
      tax_percent: 0,
      tax_amount: 0,
      total,
      bank_name: "QRIS",
      template: "modern",
      status,
      notes: `Order ID: ${order.order_id}`,
    })
    .select("id, invoice_number")
    .single();
  if (invoiceError || !invoice) throw new Error(`Invoice tidak dapat dibuat: ${invoiceError?.message || "unknown error"}`);

  const lines = Array.isArray(order.price_snapshot) ? order.price_snapshot as PaymentLineItem[] : [];
  const items = lines.length > 0
    ? lines.map((line, index) => ({ invoice_id: invoice.id, description: line.name, quantity: line.quantity, price: line.unit_price, sort_order: index }))
    : [{ invoice_id: invoice.id, description: order.package_name, quantity: 1, price: Number(order.catalog_subtotal || order.amount), sort_order: 0 }];
  const { error: itemError } = await supabase.from("invoice_items").insert(items);
  if (itemError) throw new Error(`Item invoice tidak dapat dibuat: ${itemError.message}`);

  const { error: relationError } = await supabase.from("payment_orders").update({ related_invoice_id: invoice.id }).eq("order_id", order.order_id);
  if (relationError) throw new Error(`Relasi invoice tidak dapat disimpan: ${relationError.message}`);
  return { invoice, created: true };
}

async function ensureFinanceTransaction(supabase: ReturnType<typeof getPaymentAdminClient>, order: DatabaseRow, amount: number) {
  const { data: existing, error: findError } = await supabase
    .from("transactions")
    .select("id")
    .eq("payment_order_id", order.order_id)
    .maybeSingle();
  if (findError) throw new Error(`Transaksi finance tidak dapat dibaca: ${findError.message}`);

  const transaction = existing || (await supabase.from("transactions").insert({
    payment_order_id: order.order_id,
    mode: "business",
    type: "income",
    amount,
    category: "posting",
    description: `Pembayaran QRIS - ${order.package_name} - ${order.customer_company}`,
    client: order.customer_company,
    date: getTodayWIB(),
    status: "paid",
    payment_method: "qris",
  }).select("id").single()).data;
  if (!transaction?.id) throw new Error("Transaksi finance tidak dapat dibuat");

  const { error } = await supabase.from("payment_orders").update({ synced_to_finance: true, related_transaction_id: transaction.id }).eq("order_id", order.order_id);
  if (error) throw new Error(`Relasi finance tidak dapat disimpan: ${error.message}`);
}

async function ensurePostingDraft(supabase: ReturnType<typeof getPaymentAdminClient>, order: DatabaseRow, amount: number) {
  const { data: existing, error: findError } = await supabase
    .from("posting_queue")
    .select("id")
    .eq("order_id", order.order_id)
    .maybeSingle();
  if (findError) throw new Error(`Antrean posting tidak dapat dibaca: ${findError.message}`);

  const { data: createdPosting, error: createPostingError } = existing
    ? { data: existing, error: null }
    : await supabase.from("posting_queue").insert({
      company_name: order.customer_company,
      whatsapp_number: order.customer_whatsapp,
      scheduled_date: getTomorrowWIB(),
      // Kolom scheduled_time di database bertipe time, bukan label periode.
      scheduled_time: "10:00:00",
      package_id: order.package_id,
      addons: toPostingAddonIds(order.addons || []),
      total_price: amount,
      status: "draft",
      order_id: order.order_id,
      poster_status: order.poster_status || "pending",
      notes: `Auto dari QRIS | ${order.customer_name} | Order: ${order.order_id}`,
    }).select("id").single();
  if (createPostingError) throw new Error(`Antrean posting tidak dapat dibuat: ${createPostingError.message}`);
  const posting = createdPosting;
  if (!posting?.id) throw new Error("Antrean posting tidak dapat dibuat");

  const { error } = await supabase.from("payment_orders").update({ synced_to_posting: true, related_posting_id: posting.id }).eq("order_id", order.order_id);
  if (error) throw new Error(`Relasi posting tidak dapat disimpan: ${error.message}`);
}

export async function createPaymentOrder(input: CreatePaymentInput) {
  const supabase = getPaymentAdminClient();
  const normalizedWhatsapp = normalizeIndonesianWhatsapp(input.customer_whatsapp);
  if (!normalizedWhatsapp) throw new Error("Gunakan nomor WhatsApp Indonesia yang valid, misalnya 0812xxxx atau 62812xxxx");
  const snapshot = buildPaymentSnapshot(input.package_id, input.addons);

  const { data: existing, error: existingError } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();
  if (existingError) throw new Error(`Sesi pembayaran tidak dapat diperiksa: ${existingError.message}`);
  if (existing) return asPaymentResponse(existing);

  const orderId = getPaymentOrderId();
  const keterangan = `${snapshot.selectedPackage.name}${snapshot.selectedAddons.length ? ` + ${snapshot.selectedAddons.map((item) => item.name).join(", ")}` : ""} - ${input.customer_company}`;
  const draft = {
    order_id: orderId,
    customer_name: input.customer_name,
    customer_whatsapp: normalizedWhatsapp,
    customer_whatsapp_normalized: normalizedWhatsapp,
    customer_company: input.customer_company,
    package_id: snapshot.selectedPackage.id,
    package_name: snapshot.selectedPackage.name,
    addons: snapshot.selectedAddons.map((item) => item.id),
    addon_names: snapshot.selectedAddons.map((item) => item.name),
    amount: snapshot.catalogSubtotal,
    catalog_subtotal: snapshot.catalogSubtotal,
    payable_amount: snapshot.catalogSubtotal,
    total_amount: snapshot.catalogSubtotal,
    price_snapshot: snapshot.lineItems,
    idempotency_key: input.idempotency_key,
    public_token: crypto.randomUUID(),
    upload_token: crypto.randomUUID(),
    status: "PENDING",
    keterangan,
  };
  const { error: insertError } = await supabase.from("payment_orders").insert(draft).select("*").single();
  if (insertError) {
    if (insertError.code === "23505") {
      const { data: racedOrder } = await supabase.from("payment_orders").select("*").eq("idempotency_key", input.idempotency_key).maybeSingle();
      if (racedOrder) return asPaymentResponse(racedOrder);
    }
    throw new Error(`Order tidak dapat dibuat: ${insertError.message}`);
  }

  try {
    const response = await fetch(`${process.env.KLIKQRIS_API_URL}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.KLIKQRIS_API_KEY!, id_merchant: process.env.KLIKQRIS_MERCHANT_ID! },
      body: JSON.stringify({ order_id: orderId, id_merchant: process.env.KLIKQRIS_MERCHANT_ID!, amount: snapshot.catalogSubtotal, keterangan }),
    });
    const provider = await response.json() as KlikQRISCreateResponse;
    if (!response.ok || !provider.status) throw new Error(provider.message || "Provider QRIS menolak pembuatan pembayaran");

    const payableAmount = Math.ceil(Number(provider.data.total_amount || snapshot.catalogSubtotal));
    const providerExpiry = provider.data.expired_at ? new Date(provider.data.expired_at).getTime() : NaN;
    const expiredAt = new Date(Math.min(
      Date.now() + PAYMENT_WINDOW_MS,
      Number.isFinite(providerExpiry) ? providerExpiry : Number.POSITIVE_INFINITY,
    )).toISOString();
    const { data: order, error: updateError } = await supabase.from("payment_orders").update({
      payable_amount: payableAmount,
      total_amount: payableAmount,
      qris_url: provider.data.qris_url || null,
      qris_image: provider.data.qris_image || null,
      direct_url: provider.data.direct_url || null,
      signature: provider.data.signature,
      expired_at: expiredAt,
      processing_error: null,
      updated_at: new Date().toISOString(),
    }).eq("order_id", orderId).select("*").single();
    if (updateError || !order) throw new Error(`QRIS dibuat tetapi order lokal tidak dapat diperbarui: ${updateError?.message || "unknown error"}`);

    const invoiceResult = await ensureInvoice(supabase, order, "pending");
    if (invoiceResult.created) {
      await Promise.all([
        emitInvoiceCreatedNotifications({ order, invoiceNumber: invoiceResult.invoice.invoice_number }),
        schedulePendingPaymentReminder(order),
        reportTelegramTransactionCreated({ order, invoiceNumber: invoiceResult.invoice.invoice_number }),
      ]);
    }
    return asPaymentResponse(order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "QRIS tidak dapat dibuat";
    await supabase.from("payment_orders").update({ status: "CANCELLED", processing_error: message, updated_at: new Date().toISOString() }).eq("order_id", orderId);
    await reportTelegramPaymentCancelled({ ...draft, status: "CANCELLED" }, message);
    throw new Error(message);
  }
}

export async function confirmPaidPayment(input: { orderId: string; paidAt?: string; amountPaid?: number; providerStatus?: string; eventKey: string; payload?: unknown }) {
  const supabase = getPaymentAdminClient();
  const { data: initial, error: initialError } = await supabase.from("payment_orders").select("*").eq("order_id", input.orderId).maybeSingle();
  if (initialError || !initial) throw new Error("Order pembayaran tidak ditemukan");

  const amount = getPayableAmount(initial, input.amountPaid);
  const { data: claimed, error: claimError } = await supabase.from("payment_orders").update({
    status: "PAID",
    paid_at: input.paidAt || new Date().toISOString(),
    payable_amount: amount,
    total_amount: amount,
    processing_error: null,
    updated_at: new Date().toISOString(),
  // A provider-confirmed payment remains valid even when its QRIS session was
  // marked expired locally before the provider status/webhook arrived.
  }).eq("order_id", input.orderId).in("status", ["PENDING", "EXPIRED"]).select("*").maybeSingle();
  if (claimError) throw new Error(`Status pembayaran tidak dapat diperbarui: ${claimError.message}`);

  const { data: order, error: refreshedError } = claimed
    ? { data: claimed, error: null }
    : await supabase.from("payment_orders").select("*").eq("order_id", input.orderId).maybeSingle();
  if (refreshedError || !order) throw new Error("Order pembayaran tidak dapat dimuat ulang");
  if (order.status !== "PAID") return { order, confirmed: false, processed: false };

  await supabase.from("payment_events").upsert({
    order_id: input.orderId,
    event_key: input.eventKey,
    provider_status: input.providerStatus || "PAID",
    payload: input.payload || {},
  }, { onConflict: "order_id,event_key", ignoreDuplicates: true });

  try {
    // Re-emit safely during reconciliation. If the invoice notification was
    // already accepted, its unique notification job prevents a duplicate; this
    // also repairs PAID orders created before the invoice event was wired up.
    const invoiceResult = await ensureInvoice(supabase, order, "paid");
    await emitInvoiceCreatedNotifications({ order, invoiceNumber: invoiceResult.invoice.invoice_number, includeCustomer: false });
    await ensureFinanceTransaction(supabase, order, amount);
    await ensurePostingDraft(supabase, order, amount);
    await supabase.from("payment_orders").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("order_id", input.orderId);
    return { order, confirmed: Boolean(claimed), processed: true, processingError: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi pembayaran gagal";
    await supabase.from("payment_orders").update({ processing_error: message }).eq("order_id", input.orderId);
    // Pembayaran sudah sah PAID. Sinkronisasi operasional dapat dipulihkan oleh
    // polling/webhook berikutnya dan tidak boleh membatalkan notifikasi customer/admin.
    return { order, confirmed: Boolean(claimed), processed: false, processingError: message };
  }
}

export async function markPaymentExpired(orderId: string, eventKey: string, payload?: unknown) {
  const supabase = getPaymentAdminClient();
  const { data: order, error } = await supabase.from("payment_orders").update({ status: "EXPIRED", updated_at: new Date().toISOString() })
    .eq("order_id", orderId).eq("status", "PENDING").select("*").maybeSingle();
  if (error) throw new Error(`Status expired tidak dapat diperbarui: ${error.message}`);
  if (order) await supabase.from("payment_events").upsert({ order_id: orderId, event_key: eventKey, provider_status: "EXPIRED", payload: payload || {} }, { onConflict: "order_id,event_key", ignoreDuplicates: true });
  return order;
}

export { asPaymentResponse, getPaymentAdminClient };
