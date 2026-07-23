import { whatsappAdminClient as supabase, writeActivityLog } from "@/services/whatsapp-audit-service";

type TelegramDeliveryStatus = "sent" | "skipped" | "failed";

export interface TelegramDeliveryResult {
  status: TelegramDeliveryStatus;
  messageIds?: number[];
  reason?: string;
}

export interface TelegramPaymentOrder {
  order_id: string;
  customer_name?: string | null;
  customer_whatsapp?: string | null;
  customer_company?: string | null;
  package_name?: string | null;
  addon_names?: string[] | null;
  amount?: number | null;
  total_amount?: number | null;
  payable_amount?: number | null;
  status?: string | null;
  created_at?: string | null;
  expired_at?: string | null;
  paid_at?: string | null;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number } | Array<{ message_id?: number }>;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? `Rp ${Math.ceil(amount).toLocaleString("id-ID")}` : "Rp 0";
}

function formatDateTimeWib(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date) + " WIB";
}

function orderAmount(order: TelegramPaymentOrder): number {
  return Number(order.payable_amount || order.total_amount || order.amount || 0);
}

function orderLines(order: TelegramPaymentOrder): string[] {
  const addons = Array.isArray(order.addon_names) && order.addon_names.length
    ? order.addon_names.join(", ")
    : "Tidak ada";
  return [
    `<b>Order ID:</b> <code>${escapeHtml(order.order_id)}</code>`,
    `<b>Customer:</b> ${escapeHtml(order.customer_name || "Pelanggan")}`,
    `<b>Perusahaan:</b> ${escapeHtml(order.customer_company || "-")}`,
    `<b>WhatsApp:</b> ${escapeHtml(order.customer_whatsapp || "-")}`,
    `<b>Paket:</b> ${escapeHtml(order.package_name || "-")}`,
    `<b>Add-on:</b> ${escapeHtml(addons)}`,
    `<b>Total:</b> ${escapeHtml(formatMoney(orderAmount(order)))}`,
  ];
}

function telegramConfig() {
  return {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim(),
  };
}

function getMessageIds(data: TelegramApiResponse): number[] {
  const results = Array.isArray(data.result) ? data.result : data.result ? [data.result] : [];
  return results.flatMap((item) => typeof item.message_id === "number" ? [item.message_id] : []);
}

async function telegramRequest(method: "sendMessage" | "sendPhoto" | "sendMediaGroup", payload: Record<string, unknown>): Promise<TelegramDeliveryResult> {
  const { token } = telegramConfig();
  if (!token) return { status: "skipped", reason: "Bot Telegram belum dikonfigurasi" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await response.json().catch(() => ({})) as TelegramApiResponse;
    if (!response.ok || !data.ok) {
      return { status: "failed", reason: data.description || `Telegram HTTP ${response.status}` };
    }
    return { status: "sent", messageIds: getMessageIds(data) };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Telegram tidak dapat dihubungi",
    };
  }
}

export async function sendTelegramAdminText(text: string): Promise<TelegramDeliveryResult> {
  const { chatId } = telegramConfig();
  if (!chatId) return { status: "skipped", reason: "Chat Admin Telegram belum dikonfigurasi" };
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export async function sendTelegramAdminPhotos(photoUrls: string[], caption: string): Promise<TelegramDeliveryResult> {
  const { chatId } = telegramConfig();
  if (!chatId) return { status: "skipped", reason: "Chat Admin Telegram belum dikonfigurasi" };
  const photos = photoUrls.filter(Boolean).slice(0, 10);
  if (!photos.length) return sendTelegramAdminText(caption);
  if (photos.length === 1) {
    const photoResult = await telegramRequest("sendPhoto", {
      chat_id: chatId,
      photo: photos[0],
      caption,
      parse_mode: "HTML",
    });
    if (photoResult.status === "sent") return photoResult;
    return sendTelegramAdminText(`${caption}\n\n⚠️ Gambar tidak dapat dimuat oleh Telegram.`);
  }

  const albumResult = await telegramRequest("sendMediaGroup", {
    chat_id: chatId,
    media: photos.map((photo, index) => ({
      type: "photo",
      media: photo,
      ...(index === 0 ? { caption, parse_mode: "HTML" } : {}),
    })),
  });
  if (albumResult.status === "sent") return albumResult;

  const fallbackResults: TelegramDeliveryResult[] = [];
  for (const [index, photo] of photos.entries()) {
    fallbackResults.push(await telegramRequest("sendPhoto", {
      chat_id: chatId,
      photo,
      caption: index === 0 ? caption : `<b>Poster ${index + 1} dari ${photos.length}</b>`,
      parse_mode: "HTML",
    }));
  }
  const sentIds = fallbackResults.flatMap((result) => result.messageIds ?? []);
  if (sentIds.length) return { status: "sent", messageIds: sentIds };
  return sendTelegramAdminText(`${caption}\n\n⚠️ Album poster tidak dapat dimuat oleh Telegram.`);
}

async function deliverPaymentEvent(input: {
  order: TelegramPaymentOrder;
  eventKey: string;
  providerStatus: string;
  send: () => Promise<TelegramDeliveryResult>;
}): Promise<TelegramDeliveryResult> {
  const internalEventKey = `internal:telegram:${input.eventKey}`;
  const { data: existing, error: readError } = await supabase
    .from("payment_events")
    .select("payload")
    .eq("order_id", input.order.order_id)
    .eq("event_key", internalEventKey)
    .maybeSingle();
  const existingPayload = existing?.payload && typeof existing.payload === "object"
    ? existing.payload as Record<string, unknown>
    : null;
  if (!readError && existingPayload?.delivery_status === "sent") {
    return { status: "skipped", reason: "Laporan Telegram sudah terkirim" };
  }

  const result = await input.send();
  const now = new Date().toISOString();
  const payload = {
    channel: "telegram",
    delivery_status: result.status,
    provider_message_ids: result.messageIds ?? [],
    delivered_at: result.status === "sent" ? now : null,
    last_attempt_at: now,
    last_error: result.status === "failed" ? result.reason ?? "Pengiriman gagal" : null,
  };
  const { error: writeError } = await supabase.from("payment_events").upsert({
    order_id: input.order.order_id,
    event_key: internalEventKey,
    provider_status: input.providerStatus,
    payload,
  }, { onConflict: "order_id,event_key" });

  const status = result.status === "sent" ? "success" : result.status === "failed" ? "failed" : "skipped";
  await writeActivityLog({
    customer: input.order.customer_whatsapp || `payment:${input.order.order_id}`,
    eventType: `telegram.payment.${input.eventKey}.${result.status}`,
    status,
    message: result.status === "sent"
      ? `Laporan Telegram ${input.eventKey} terkirim`
      : `Laporan Telegram ${input.eventKey} ${result.status}: ${result.reason || "tanpa keterangan"}`,
    metadata: {
      order_id: input.order.order_id,
      event_key: input.eventKey,
      provider_message_ids: result.messageIds ?? [],
      payment_event_saved: !writeError,
    },
  });
  if (writeError) {
    console.error("[TelegramAdmin] Status laporan tidak dapat disimpan", {
      orderId: input.order.order_id,
      eventKey: input.eventKey,
      error: writeError.message,
    });
  }
  return result;
}

export function reportTelegramTransactionCreated(input: {
  order: TelegramPaymentOrder;
  invoiceNumber: string;
}): Promise<TelegramDeliveryResult> {
  const text = [
    "<b>🧾 TRANSAKSI BARU • MENUNGGU PEMBAYARAN</b>",
    "",
    ...orderLines(input.order),
    `<b>Invoice:</b> ${escapeHtml(input.invoiceNumber)}`,
    `<b>Batas pembayaran:</b> ${escapeHtml(formatDateTimeWib(input.order.expired_at))}`,
    "",
    "Status: QRIS berhasil dibuat dan invoice telah tercatat.",
  ].join("\n");
  return deliverPaymentEvent({
    order: input.order,
    eventKey: "created",
    providerStatus: "PENDING",
    send: () => sendTelegramAdminText(text),
  });
}

export function reportTelegramPaymentPaid(input: {
  order: TelegramPaymentOrder;
  processed: boolean;
  processingError?: string | null;
}): Promise<TelegramDeliveryResult> {
  const operationalStatus = input.processed
    ? "Invoice, keuangan, dan antrean posting sudah tersinkron."
    : `Pembayaran sah, tetapi sinkronisasi operasional perlu diperiksa${input.processingError ? `: ${input.processingError}` : "."}`;
  const text = [
    "<b>✅ PEMBAYARAN QRIS TERKONFIRMASI</b>",
    "",
    ...orderLines(input.order),
    `<b>Waktu bayar:</b> ${escapeHtml(formatDateTimeWib(input.order.paid_at))}`,
    "",
    `<b>Status operasional:</b> ${escapeHtml(operationalStatus)}`,
    "Tindakan berikutnya: tunggu poster customer atau lanjutkan pengecekan antrean.",
  ].join("\n");
  return deliverPaymentEvent({
    order: input.order,
    eventKey: "paid",
    providerStatus: "PAID",
    send: () => sendTelegramAdminText(text),
  });
}

export function reportTelegramPaymentExpired(order: TelegramPaymentOrder): Promise<TelegramDeliveryResult> {
  const text = [
    "<b>⌛ TRANSAKSI KEDALUWARSA</b>",
    "",
    ...orderLines(order),
    `<b>Batas pembayaran:</b> ${escapeHtml(formatDateTimeWib(order.expired_at))}`,
    "",
    "Status: belum ada pembayaran terkonfirmasi. Tidak ada antrean posting yang dijalankan.",
  ].join("\n");
  return deliverPaymentEvent({
    order,
    eventKey: "expired",
    providerStatus: "EXPIRED",
    send: () => sendTelegramAdminText(text),
  });
}

export function reportTelegramPaymentCancelled(order: TelegramPaymentOrder, reason: string): Promise<TelegramDeliveryResult> {
  const text = [
    "<b>⚠️ TRANSAKSI GAGAL DIBUAT</b>",
    "",
    ...orderLines(order),
    "",
    `<b>Kendala:</b> ${escapeHtml(reason)}`,
    "Status: dibatalkan dan perlu dicek apabila customer mencoba kembali.",
  ].join("\n");
  return deliverPaymentEvent({
    order,
    eventKey: "cancelled",
    providerStatus: "CANCELLED",
    send: () => sendTelegramAdminText(text),
  });
}

export function reportTelegramPosterReceived(input: {
  order: TelegramPaymentOrder;
  posterUrls: string[];
  scheduledDate?: string | null;
  caption?: string | null;
}): Promise<TelegramDeliveryResult> {
  const captionSummary = input.caption?.trim()
    ? input.caption.trim().slice(0, 260)
    : "Tidak ada caption dari customer";
  const text = [
    "<b>🖼️ POSTER CUSTOMER DITERIMA</b>",
    "",
    ...orderLines(input.order),
    `<b>Jumlah poster:</b> ${input.posterUrls.length}`,
    `<b>Target jadwal:</b> ${escapeHtml(input.scheduledDate || "Menunggu penjadwalan")}`,
    `<b>Caption customer:</b> ${escapeHtml(captionSummary)}`,
    "",
    "Status: poster tersimpan dan siap diperiksa pada antrean posting.",
  ].join("\n");
  return deliverPaymentEvent({
    order: input.order,
    eventKey: "poster-received",
    providerStatus: "POSTER_UPLOADED",
    send: () => sendTelegramAdminPhotos(input.posterUrls, text),
  });
}

export function reportTelegramPosterDeferred(order: TelegramPaymentOrder): Promise<TelegramDeliveryResult> {
  const text = [
    "<b>🕓 POSTER AKAN DIUNGGAH NANTI</b>",
    "",
    ...orderLines(order),
    "",
    "Status: pembayaran sudah lunas, tetapi customer memilih melanjutkan unggah poster di lain waktu.",
  ].join("\n");
  return deliverPaymentEvent({
    order,
    eventKey: "poster-deferred",
    providerStatus: "POSTER_DEFERRED",
    send: () => sendTelegramAdminText(text),
  });
}
