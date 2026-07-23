import { getDynamicAccounts } from "@/lib/whatsapp/kirimdev-client";
import { describeServiceWindow, getServiceWindowStatus } from "@/lib/whatsapp/service-window";
import { refreshRecipientActivityFromProvider } from "@/services/whatsapp-inbox-sync-service";
import { sendMappedTemplate, type TemplateData } from "@/services/kirimdev-mapper";
import { whatsappAdminClient as supabase, writeActivityLog } from "@/services/whatsapp-audit-service";

type RecipientType = "customer" | "admin" | "bot" | "custom";
type SenderRole = "admin" | "bot";

interface NotificationRuleRow {
  id: string;
  event_key: string;
  name: string;
  recipient_type: RecipientType;
  custom_recipient: string | null;
  sender_role: SenderRole;
  template_id: string | null;
  is_active: boolean;
  delay_seconds: number;
  max_attempts: number;
  dedupe_window_seconds: number;
  variable_defaults: Record<string, string> | null;
  template: TemplateData | null;
}

interface NotificationJobRow {
  id: string;
  event_key: string;
  rule_id: string | null;
  template_id: string | null;
  recipient: string;
  sender_phone_id: string;
  payload: { variables?: Record<string, unknown>; fallback_template?: TemplateData; requires_recipient_window?: boolean; payment_order_id?: string };
  attempts: number;
  max_attempts: number;
  template: TemplateData | null;
}

interface FallbackDefinition {
  recipientType: RecipientType;
  senderRole: SenderRole;
  delaySeconds: number;
  dedupeWindowSeconds: number;
  template: TemplateData;
}

const FALLBACKS: Record<string, FallbackDefinition> = {
  "payment.paid.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 86400,
    template: { id: "fallback-payment-customer", name: "Invoice Setelah Pembayaran", type: "text", preview_url: false, body: "Halo Kak {{customer_name}} 👋\n\nPembayaran untuk *{{package_name}}* sebesar *Rp {{amount}}* telah kami terima dan terkonfirmasi. ✅\n\nInvoice pembayaran dapat dilihat dan diunduh melalui link berikut:\n{{invoice_url}}\n\nPoster dan pesanan Kakak akan segera kami proses sesuai paket yang dipilih.\n\nTerima kasih atas kepercayaannya.\n— Admin InfoLokerJombang" },
  },
  "payment.paid.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 86400,
    template: { id: "fallback-payment-admin", name: "Notif Pembayaran Admin", type: "text", body: "✅ *PEMBAYARAN BERHASIL*\n\nNominal: *Rp {{amount}}*\nKlien: {{customer_name}} ({{company_name}})\nLayanan: {{package_name}}\nOrder ID: {{order_id}}\n\nPesanan sudah masuk antrean posting." },
  },
  "invoice.created.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 300,
    template: { id: "fallback-invoice-admin", name: "Notif Invoice Baru Admin", type: "url_button", body: "🚨 *INVOICE BARU DIBUAT*\n\nID: {{invoice_number}}\nKlien: {{customer_name}}\nTotal: Rp {{amount}}\nStatus: Menunggu Pembayaran", buttons: [{ id: "open_admin_invoice", title: "Buka Invoice", url: "{{invoice_url}}" }] },
  },
  "poster.received.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 86400,
    template: { id: "fallback-poster-customer", name: "Konfirmasi Poster Diterima", type: "text", body: "Halo Kak {{customer_name}} 👋\n\nPoster lowongan *{{company_name}}* sudah kami terima dan sudah masuk *antrean posting*. ✅\n\nPaket: *{{package_name}}*\nJumlah poster: *{{poster_count}}*\nTarget jadwal: *{{scheduled_date}}*\n\nTim kami akan mengecek materi lalu menerbitkannya sesuai antrean. Terima kasih — Admin InfoLokerJombang" },
  },
  "poster.received.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 86400,
    template: { id: "fallback-poster-admin", name: "Laporan Poster Masuk", type: "text", body: "🖼️ *POSTER MASUK ANTREAN*\n\nKlien: {{customer_name}} ({{company_name}})\nPaket: {{package_name}}\nJumlah poster: {{poster_count}}\nOrder ID: {{order_id}}\nTarget jadwal: {{scheduled_date}}\n\nStatus antrean: siap diproses." },
  },
  "customer.message.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 86400,
    template: { id: "fallback-customer-message-admin", name: "Laporan Aktivitas Customer", type: "text", body: "💬 *AKTIVITAS CUSTOMER*\n\nNomor: {{customer_phone}}\nJenis: {{message_type}}\nPesan: {{message}}\n\nBot telah mencatat aktivitas customer ini." },
  },
  "invoice.created.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 86400,
    template: { id: "fallback-invoice-customer", name: "QRIS Baru Customer", type: "text", preview_url: false, body: "Halo Kak {{customer_name}} 👋\n\nTagihan untuk *{{package_name}}* sebesar *Rp {{amount}}* telah dibuat.\n\nSilakan buka link berikut untuk melihat QRIS dan menyelesaikan pembayaran:\n{{payment_url}}\n\nMohon pastikan nominal dan nama merchant sudah sesuai sebelum melakukan pembayaran.\n\nTerima kasih.\n— Admin InfoLokerJombang" },
  },
  "invoice.reminder.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 3600,
    template: { id: "fallback-invoice-reminder", name: "Pengingat QRIS Customer", type: "text", preview_url: false, body: "Halo Kak {{customer_name}} 👋\n\nKami mengingatkan bahwa pembayaran QRIS untuk *{{package_name}}* sebesar *Rp {{amount}}* masih menunggu.\n\nSilakan lanjutkan pembayaran melalui link berikut:\n{{payment_url}}\n\nApabila pembayaran telah dilakukan, pesan ini dapat diabaikan.\n\nTerima kasih.\n— Admin InfoLokerJombang" },
  },
};

export interface EmitNotificationInput {
  eventKey: string;
  customerPhone?: string | null;
  variables: Record<string, unknown>;
  dedupeId?: string | null;
  delaySeconds?: number;
  paymentOrderId?: string | null;
}

interface PaymentNotificationOrder {
  order_id: string;
  customer_name?: string | null;
  customer_whatsapp?: string | null;
  customer_company?: string | null;
  package_name?: string | null;
  amount?: number | null;
  total_amount?: number | null;
  payable_amount?: number | null;
  public_token?: string | null;
}

interface InvoiceNotificationOrder extends PaymentNotificationOrder {
  public_token?: string | null;
}

export type EmitNotificationResult =
  | { status: "sent"; jobId?: string; messageId?: string }
  | { status: "queued"; jobId: string; scheduledAt: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://infolokerjombang.net").replace(/\/$/, "");
}

/** Emits the two configured payment-success rules. The job dedupe key makes this safe to call again during reconciliation. */
export async function emitPaymentPaidNotifications(order: PaymentNotificationOrder): Promise<EmitNotificationResult[]> {
  const amount = Number(order.payable_amount || order.total_amount || order.amount || 0);
  const invoiceUrl = order.public_token ? `${getAppUrl()}/pay/${order.public_token}` : `${getAppUrl()}/payment`;
  const variables = {
    customer_name: order.customer_name || "Pelanggan",
    company_name: order.customer_company || "-",
    package_name: order.package_name || "Paket Anda",
    amount: formatRupiahValue(amount),
    order_id: order.order_id,
    invoice_url: invoiceUrl,
  };
  return Promise.all([
    emitNotification({ eventKey: "payment.paid.admin", variables, dedupeId: order.order_id }),
    emitNotification({ eventKey: "payment.paid.customer", customerPhone: order.customer_whatsapp, variables, dedupeId: order.order_id }),
  ]);
}

/** Queue one reminder five minutes after QRIS creation. The worker verifies the order is still pending before sending it. */
export async function schedulePendingPaymentReminder(order: PaymentNotificationOrder): Promise<EmitNotificationResult> {
  const amount = Number(order.payable_amount || order.total_amount || order.amount || 0);
  const paymentUrl = order.public_token ? `${getAppUrl()}/pay/${order.public_token}/qris` : `${getAppUrl()}/payment`;
  return emitNotification({
    eventKey: "invoice.reminder.customer",
    customerPhone: order.customer_whatsapp,
    dedupeId: `payment-reminder:${order.order_id}`,
    delaySeconds: 5 * 60,
    paymentOrderId: order.order_id,
    variables: {
      customer_name: order.customer_name || "Pelanggan",
      company_name: order.customer_company || "-",
      package_name: order.package_name || "Paket Anda",
      amount: formatRupiahValue(amount),
      order_id: order.order_id,
      payment_url: paymentUrl,
    },
  });
}

/** Emits invoice rules immediately after a QRIS order has successfully created its invoice. */
export async function emitInvoiceCreatedNotifications(input: { order: InvoiceNotificationOrder; invoiceNumber: string; includeCustomer?: boolean }): Promise<EmitNotificationResult[]> {
  const { order, invoiceNumber } = input;
  const amount = Number(order.payable_amount || order.total_amount || order.amount || 0);
  const paymentUrl = order.public_token ? `${getAppUrl()}/pay/${order.public_token}/qris` : `${getAppUrl()}/payment`;
  const invoiceUrl = order.public_token ? `${getAppUrl()}/pay/${order.public_token}` : `${getAppUrl()}/payment`;
  const variables = {
    customer_name: order.customer_name || "Pelanggan",
    customer_phone: normalizePhone(order.customer_whatsapp || ""),
    company_name: order.customer_company || "-",
    package_name: order.package_name || "Paket Anda",
    amount: formatRupiahValue(amount),
    order_id: order.order_id,
    invoice_number: invoiceNumber,
    payment_url: paymentUrl,
    invoice_url: invoiceUrl,
  };
  const results = await Promise.all([
    emitNotification({ eventKey: "invoice.created.admin", variables, dedupeId: order.order_id }),
  ]);
  if (input.includeCustomer === false) return results;
  results.push(await emitNotification({ eventKey: "invoice.created.customer", customerPhone: order.customer_whatsapp, variables, dedupeId: order.order_id }));
  return results;
}

export async function emitPosterReceivedNotifications(input: {
  order: PaymentNotificationOrder;
  posterCount: number;
  scheduledDate?: string | null;
}): Promise<EmitNotificationResult[]> {
  const { order } = input;
  const variables = {
    customer_name: order.customer_name || "Pelanggan",
    company_name: order.customer_company || "-",
    package_name: order.package_name || "Paket Anda",
    order_id: order.order_id,
    poster_count: input.posterCount,
    scheduled_date: input.scheduledDate || "Menunggu penjadwalan",
  };
  return Promise.all([
    emitNotification({ eventKey: "poster.received.customer", customerPhone: order.customer_whatsapp, variables, dedupeId: order.order_id }),
    emitNotification({ eventKey: "poster.received.admin", variables, dedupeId: order.order_id }),
  ]);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits.startsWith("62") ? digits : `62${digits}`;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || error.message?.includes("notification_")));
}

function renderText(value: string, variables: Record<string, unknown>): string {
  return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const replacement = variables[key];
    return replacement === null || replacement === undefined ? "" : String(replacement);
  });
}

function renderValue(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") return renderText(value, variables);
  if (Array.isArray(value)) return value.map((item) => renderValue(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, renderValue(item, variables)]));
  }
  return value;
}

export function renderNotificationTemplate(template: TemplateData, variables: Record<string, unknown>): TemplateData {
  return renderValue(template, variables) as TemplateData;
}

const REQUIRED_TEXT_LINK_VARIABLES: Record<string, "payment_url" | "invoice_url"> = {
  "invoice.created.customer": "payment_url",
  "invoice.reminder.customer": "payment_url",
  "payment.paid.customer": "invoice_url",
};

export function validateRenderedNotificationLink(
  eventKey: string,
  template: TemplateData,
  variables: Record<string, unknown>,
): string | null {
  const variableName = REQUIRED_TEXT_LINK_VARIABLES[eventKey];
  if (!variableName || template.type !== "text") return null;

  const link = String(variables[variableName] ?? "").trim();
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== "https:") return `Link HTTPS ${variableName} tidak valid`;
  } catch {
    return `Link HTTPS ${variableName} tidak valid`;
  }

  if (!template.body.includes(link)) {
    return `Template text ${eventKey} wajib memuat ${variableName}`;
  }
  return null;
}

async function resolveRoute(recipientType: RecipientType, customRecipient: string | null, senderRole: SenderRole, customerPhone?: string | null) {
  const accounts = await getDynamicAccounts();
  const admin = accounts[0];
  const bot = accounts[1];
  const requiredSender: SenderRole = recipientType === "admin" ? "bot" : "admin";
  if (senderRole !== requiredSender) {
    throw new Error(
      recipientType === "admin"
        ? "Rute ke Admin Utama wajib dikirim oleh Bot"
        : "Rute ke Bot, customer, atau nomor custom wajib dikirim oleh Admin Utama",
    );
  }
  const sender = senderRole === "bot" ? bot : admin;
  if (!sender?.phoneId) throw new Error(`Akun pengirim ${senderRole === "bot" ? "Bot" : "Admin Utama"} belum dikonfigurasi`);

  const recipient = recipientType === "admin"
    ? normalizePhone(admin?.phoneNumber ?? "")
    : recipientType === "bot"
      ? normalizePhone(bot?.phoneNumber ?? "")
    : recipientType === "custom"
      ? normalizePhone(customRecipient ?? "")
      : normalizePhone(customerPhone ?? "");
  if (!recipient) throw new Error("Nomor penerima notifikasi tidak tersedia");
  if (normalizePhone(sender.phoneNumber) === recipient) throw new Error("Pengirim dan penerima tidak boleh nomor yang sama");
  return { senderPhoneId: sender.phoneId, recipient };
}

async function sendDirect(
  eventKey: string,
  senderPhoneId: string,
  recipient: string,
  template: TemplateData,
  variables: Record<string, unknown>,
  correlationId: string,
  ruleId?: string | null,
): Promise<EmitNotificationResult> {
  const rendered = renderNotificationTemplate(template, variables);
  const linkValidationError = validateRenderedNotificationLink(eventKey, rendered, variables);
  if (linkValidationError) return { status: "failed", error: linkValidationError };
  const result = await sendMappedTemplate(senderPhoneId, recipient, rendered, {
    source: `notification:${eventKey}`,
    correlationId,
    ruleId: ruleId ?? undefined,
    templateId: template.id.startsWith("fallback-") ? undefined : template.id,
  });
  await writeActivityLog({
    customer: recipient,
    eventType: `notification.${result.success ? "sent" : "failed"}`,
    status: result.success ? "pending" : "failed",
    message: result.success ? `${eventKey} diterima KirimDev; menunggu status delivery` : result.error ?? `${eventKey} gagal dikirim`,
    templateId: template.id.startsWith("fallback-") ? undefined : template.id,
    metadata: { event_key: eventKey, correlation_id: correlationId, provider_message_id: result.messageId ?? null, rule_id: ruleId ?? null },
  });
  return result.success
    ? { status: "sent", messageId: result.messageId }
    : { status: "failed", error: result.error ?? "KirimDev menolak pengiriman" };
}

async function getRule(eventKey: string): Promise<{ rule: NotificationRuleRow | null; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from("notification_rules")
    .select("id,event_key,name,recipient_type,custom_recipient,sender_role,template_id,is_active,delay_seconds,max_attempts,dedupe_window_seconds,variable_defaults,template:templates(*)")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (isMissingTable(error)) return { rule: null, tableMissing: true };
  if (error) throw new Error(`Rule notifikasi gagal dibaca: ${error.message}`);
  return { rule: data as unknown as NotificationRuleRow | null, tableMissing: false };
}

async function getRecipientServiceWindow(recipient: string, senderPhoneId: string) {
  const readLocalWindow = async () => {
    const { data, error } = await supabase.from("whatsapp_contact_activity")
      .select("last_inbound_at")
      .eq("customer", recipient)
      .eq("sender_phone_id", senderPhoneId)
      .maybeSingle();
    if (error) throw new Error(`Jendela layanan customer gagal dibaca: ${error.message}`);
    return getServiceWindowStatus(data?.last_inbound_at ?? null);
  };

  const localWindow = await readLocalWindow();
  if (localWindow.state === "active") return localWindow;

  // A webhook can be delayed or missed. Before blocking a free-form message,
  // reconcile the latest provider conversation for this exact sender account.
  try {
    const refreshed = await refreshRecipientActivityFromProvider({ recipient, senderPhoneId });
    if (refreshed) return await readLocalWindow();
  } catch (error) {
    console.error("[Notification] recipient window refresh failed", { recipient, senderPhoneId, error });
  }
  return localWindow;
}

async function logCustomerWindowBlock(input: { eventKey: string; recipient: string; reason: string; jobId?: string; ruleId?: string | null; test?: boolean }) {
  await writeActivityLog({
    customer: input.recipient,
    eventType: "notification.blocked_24h",
    status: "skipped",
    message: `${input.eventKey} tidak dikirim. ${input.reason}`,
    metadata: { event_key: input.eventKey, job_id: input.jobId ?? null, rule_id: input.ruleId ?? null, test: input.test ?? false, reason: "outside_or_unknown_24h_window" },
  });
}

export async function emitNotification(input: EmitNotificationInput): Promise<EmitNotificationResult> {
  const fallback = FALLBACKS[input.eventKey];
  try {
    const { rule, tableMissing } = await getRule(input.eventKey);
    if (rule && !rule.is_active) return { status: "skipped", reason: "Rule dinonaktifkan" };
    if (!rule && !fallback) return { status: "skipped", reason: "Rule event belum tersedia" };

    const recipientType = rule?.recipient_type ?? fallback!.recipientType;
    const senderRole = rule?.sender_role ?? fallback!.senderRole;
    const route = await resolveRoute(recipientType, rule?.custom_recipient ?? null, senderRole, input.customerPhone);
    const template = rule?.template ?? fallback?.template;
    if (!template) return { status: "failed", error: "Pesan Tersimpan belum dipilih pada rule notifikasi" };
    const variables = { ...(rule?.variable_defaults ?? {}), ...input.variables };
    const delaySeconds = input.delaySeconds ?? rule?.delay_seconds ?? fallback?.delaySeconds ?? 0;
    const maxAttempts = rule?.max_attempts ?? 3;
    const windowSeconds = rule?.dedupe_window_seconds ?? fallback?.dedupeWindowSeconds ?? 300;
    const bucket = Math.floor(Date.now() / Math.max(1000, windowSeconds * 1000));
    const dedupeKey = `${input.eventKey}:${input.dedupeId || route.recipient}:${input.dedupeId ? "event" : bucket}`;

    const serviceWindow = await getRecipientServiceWindow(route.recipient, route.senderPhoneId);
    if (serviceWindow.state !== "active") {
      const reason = describeServiceWindow(serviceWindow);
      await logCustomerWindowBlock({ eventKey: input.eventKey, recipient: route.recipient, reason, ruleId: rule?.id });
      return { status: "skipped", reason };
    }

    if (tableMissing) {
      return sendDirect(input.eventKey, route.senderPhoneId, route.recipient, template, variables, dedupeKey, rule?.id);
    }

    const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const { data: job, error: jobError } = await supabase.from("notification_jobs").insert({
      event_key: input.eventKey,
      rule_id: rule?.id ?? null,
      template_id: rule?.template_id ?? null,
      recipient: route.recipient,
      sender_phone_id: route.senderPhoneId,
      payload: { variables, fallback_template: rule?.template ? undefined : template, requires_recipient_window: true, payment_order_id: input.paymentOrderId ?? undefined },
      status: "queued",
      max_attempts: maxAttempts,
      scheduled_at: scheduledAt,
      dedupe_key: dedupeKey,
    }).select("id").single();
    if (jobError?.code === "23505") return { status: "skipped", reason: "Event duplikat sudah diproses" };
    if (jobError || !job) throw new Error(`Antrean notifikasi gagal dibuat: ${jobError?.message ?? "unknown error"}`);

    await writeActivityLog({
      customer: route.recipient,
      eventType: "notification.queued",
      status: "pending",
      message: `${input.eventKey} masuk antrean`,
      templateId: rule?.template_id ?? undefined,
      metadata: { job_id: job.id, event_key: input.eventKey, scheduled_at: scheduledAt, sender_role: senderRole },
    });
    // Delay pendek perlu dieksekusi pada request yang sama. Cron proyek saat ini
    // bersifat fallback; tanpa ini rule bawaan dengan delay 2 detik bisa menunggu
    // terlalu lama saat tidak ada webhook lain yang masuk.
    if (delaySeconds > 0 && delaySeconds <= 5) {
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      const result = await processNotificationJob(job.id);
      return result.status === "sent" ? { ...result, jobId: job.id } : result;
    }
    if (delaySeconds > 0) return { status: "queued", jobId: job.id, scheduledAt };
    const result = await processNotificationJob(job.id);
    return result.status === "sent" ? { ...result, jobId: job.id } : result;
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Notifikasi gagal diproses";
    await writeActivityLog({ customer: normalizePhone(input.customerPhone ?? "system") || "system", eventType: "notification.failed", status: "failed", message: error, metadata: { event_key: input.eventKey } });
    return { status: "failed", error };
  }
}

export async function processNotificationJob(jobId: string): Promise<EmitNotificationResult> {
  const { data, error } = await supabase
    .from("notification_jobs")
    .update({ status: "processing" })
    .eq("id", jobId)
    .in("status", ["queued", "retry"])
    .select("id,event_key,rule_id,template_id,recipient,sender_phone_id,payload,attempts,max_attempts,template:templates(*)")
    .maybeSingle();
  if (error) return { status: "failed", error: error.message };
  if (!data) return { status: "skipped", reason: "Job sudah diproses worker lain" };
  const job = data as unknown as NotificationJobRow;
  const template = job.template ?? job.payload.fallback_template;
  if (!template) {
    await supabase.from("notification_jobs").update({ status: "failed", last_error: "Pesan Tersimpan tidak tersedia" }).eq("id", job.id);
    return { status: "failed", error: "Pesan Tersimpan tidak tersedia" };
  }

  if (job.payload.payment_order_id) {
    const { data: paymentOrder, error: paymentError } = await supabase
      .from("payment_orders")
      .select("status,expired_at")
      .eq("order_id", job.payload.payment_order_id)
      .maybeSingle();
    const expired = !paymentOrder?.expired_at || new Date(paymentOrder.expired_at).getTime() <= Date.now();
    if (paymentError || !paymentOrder || paymentOrder.status !== "PENDING" || expired) {
      const reason = paymentError
        ? `Pengingat pembayaran dibatalkan: status order tidak dapat dibaca (${paymentError.message})`
        : !paymentOrder ? "Pengingat pembayaran dibatalkan: order tidak ditemukan"
          : paymentOrder.status !== "PENDING" ? `Pengingat pembayaran dibatalkan: status order sudah ${paymentOrder.status}`
            : "Pengingat pembayaran dibatalkan: QRIS sudah kedaluwarsa";
      await supabase.from("notification_jobs").update({ status: "failed", last_error: reason }).eq("id", job.id);
      await writeActivityLog({ customer: job.recipient, eventType: "notification.payment_reminder.skipped", status: "skipped", message: reason, metadata: { job_id: job.id, order_id: job.payload.payment_order_id } });
      return { status: "skipped", reason };
    }
  }

  // Existing queued jobs from before this field was introduced must be
  // protected too; all current Notification Center sends are free-form.
  if (job.payload.requires_recipient_window !== false) {
    const serviceWindow = await getRecipientServiceWindow(job.recipient, job.sender_phone_id);
    if (serviceWindow.state !== "active") {
      const reason = describeServiceWindow(serviceWindow);
      await supabase.from("notification_jobs").update({ status: "failed", last_error: reason }).eq("id", job.id);
      await logCustomerWindowBlock({ eventKey: job.event_key, recipient: job.recipient, reason, jobId: job.id, ruleId: job.rule_id });
      return { status: "skipped", reason };
    }
  }

  const attempt = job.attempts + 1;
  const result = await sendDirect(job.event_key, job.sender_phone_id, job.recipient, template, job.payload.variables ?? {}, job.id, job.rule_id);
  if (result.status === "sent") {
    await supabase.from("notification_jobs").update({ status: "sent", attempts: attempt, provider_message_id: result.messageId ?? null, last_error: null, sent_at: new Date().toISOString() }).eq("id", job.id);
    return result;
  }
  const canRetry = attempt < job.max_attempts;
  const retryAt = new Date(Date.now() + Math.min(300, 15 * (2 ** (attempt - 1))) * 1000).toISOString();
  const lastError = result.status === "failed" ? result.error : result.status === "skipped" ? result.reason : "Pengiriman belum selesai";
  await supabase.from("notification_jobs").update({ status: canRetry ? "retry" : "failed", attempts: attempt, scheduled_at: retryAt, last_error: lastError }).eq("id", job.id);
  return result;
}

export async function processDueNotificationJobs(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
  const { data, error } = await supabase.from("notification_jobs").select("id").in("status", ["queued", "retry"]).lte("scheduled_at", new Date().toISOString()).order("scheduled_at", { ascending: true }).limit(Math.min(100, Math.max(1, limit)));
  if (isMissingTable(error)) return { processed: 0, sent: 0, failed: 0 };
  if (error) throw new Error(error.message);
  let sent = 0;
  let failed = 0;
  for (const item of data ?? []) {
    const result = await processNotificationJob(item.id);
    if (result.status === "sent") sent += 1;
    else if (result.status === "failed") failed += 1;
  }
  return { processed: data?.length ?? 0, sent, failed };
}

export async function testNotificationRule(ruleId: string, customerPhone?: string): Promise<EmitNotificationResult> {
  const { data, error } = await supabase
    .from("notification_rules")
    .select("id,event_key,recipient_type,custom_recipient,sender_role,template:templates(*)")
    .eq("id", ruleId)
    .single();
  if (error || !data) return { status: "failed", error: error?.message ?? "Rule tidak ditemukan" };
  const rule = data as unknown as Pick<NotificationRuleRow, "id" | "event_key" | "recipient_type" | "custom_recipient" | "sender_role"> & { template: TemplateData | null };
  if (rule.recipient_type === "customer" && !normalizePhone(customerPhone ?? "")) {
    return { status: "failed", error: "Nomor customer untuk tes wajib diisi" };
  }
  const route = await resolveRoute(rule.recipient_type, rule.custom_recipient, rule.sender_role, customerPhone);
  const template = rule.template;
  if (!template) return { status: "failed", error: "Pesan Tersimpan belum dipilih" };
  const serviceWindow = await getRecipientServiceWindow(route.recipient, route.senderPhoneId);
  if (serviceWindow.state !== "active") {
    const reason = describeServiceWindow(serviceWindow);
    await logCustomerWindowBlock({ eventKey: rule.event_key, recipient: route.recipient, reason, ruleId: rule.id, test: true });
    return { status: "skipped", reason };
  }
  const variables = {
    customer_name: "Customer Test", company_name: "PT Contoh", package_name: "Paket Highlight",
    amount: "150.000", order_id: "TEST-123", invoice_number: "INV-TEST-123",
    payment_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://infolokerjombang.net"}/pay/TEST-123/qris`,
    invoice_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://infolokerjombang.net"}/pay/TEST-123`,
    scheduled_date: new Date().toLocaleDateString("id-ID"), poster_count: 1, customer_phone: normalizePhone(customerPhone ?? route.recipient),
  };
  return sendDirect(rule.event_key, route.senderPhoneId, route.recipient, template, variables, `test:${ruleId}:${Date.now()}`, rule.id);
}

export function formatRupiahValue(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("id-ID") : "0";
}
