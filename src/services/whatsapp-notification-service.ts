import { getDynamicAccounts } from "@/lib/whatsapp/kirimdev-client";
import { sendMappedTemplate, type TemplateData } from "@/services/kirimdev-mapper";
import { whatsappAdminClient as supabase, writeActivityLog } from "@/services/whatsapp-audit-service";

type RecipientType = "customer" | "admin" | "custom";
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
  payload: { variables?: Record<string, unknown>; fallback_template?: TemplateData };
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
    template: { id: "fallback-payment-customer", name: "Notif Pembayaran Customer", type: "text", body: "Halo Kak {{customer_name}} 👋\n\nPembayaran untuk *{{package_name}}* sebesar *Rp {{amount}}* telah berhasil kami terima. ✅\n\nOrder ID: *{{order_id}}*\nPoster dan pesanan Kakak akan segera kami proses.\n\nTerima kasih — Admin InfoLokerJombang" },
  },
  "payment.paid.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 86400,
    template: { id: "fallback-payment-admin", name: "Notif Pembayaran Admin", type: "text", body: "✅ *PEMBAYARAN BERHASIL*\n\nNominal: *Rp {{amount}}*\nKlien: {{customer_name}} ({{company_name}})\nLayanan: {{package_name}}\nOrder ID: {{order_id}}\n\nPesanan sudah masuk antrean posting." },
  },
  "invoice.created.admin": {
    recipientType: "admin", senderRole: "bot", delaySeconds: 0, dedupeWindowSeconds: 300,
    template: { id: "fallback-invoice-admin", name: "Notif Invoice Baru Admin", type: "text", body: "🚨 *INVOICE BARU DIBUAT*\n\nID: {{invoice_number}}\nKlien: {{customer_name}}\nTotal: Rp {{amount}}\nStatus: Menunggu Pembayaran\n\n{{invoice_url}}" },
  },
  "poster.received.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 86400,
    template: { id: "fallback-poster-customer", name: "Konfirmasi Poster Diterima", type: "text", body: "Halo Kak {{customer_name}} 👋\n\nPoster lowongan *{{company_name}}* sudah kami terima! ✅\n\nTim kami akan segera memproses dan menjadwalkan posting sesuai paket yang dipilih.\n\nTerima kasih — Admin InfoLokerJombang" },
  },
  "invoice.created.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 86400,
    template: { id: "fallback-invoice-customer", name: "Invoice Baru Customer", type: "text", body: "Halo Kak {{customer_name}} 👋\n\nBerikut invoice untuk *{{package_name}}* senilai *Rp {{amount}}*.\n\n🔗 {{payment_url}}\n\nSilakan buka link untuk melihat detail tagihan dan menyelesaikan pembayaran. Terima kasih." },
  },
  "invoice.reminder.customer": {
    recipientType: "customer", senderRole: "admin", delaySeconds: 2, dedupeWindowSeconds: 3600,
    template: { id: "fallback-invoice-reminder", name: "Pengingat Pembayaran Customer", type: "text", body: "Halo Kak {{customer_name}} 👋\n\nKami mengingatkan bahwa tagihan *{{package_name}}* senilai *Rp {{amount}}* masih menunggu pembayaran.\n\n🔗 {{payment_url}}\n\nJika sudah membayar, pesan ini dapat diabaikan. Terima kasih." },
  },
};

export interface EmitNotificationInput {
  eventKey: string;
  customerPhone?: string | null;
  variables: Record<string, unknown>;
  dedupeId?: string | null;
}

export type EmitNotificationResult =
  | { status: "sent"; jobId?: string; messageId?: string }
  | { status: "queued"; jobId: string; scheduledAt: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

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

async function resolveRoute(recipientType: RecipientType, customRecipient: string | null, senderRole: SenderRole, customerPhone?: string | null) {
  const accounts = await getDynamicAccounts();
  const admin = accounts[0];
  const bot = accounts[1];
  const sender = senderRole === "bot" ? bot : admin;
  if (!sender?.phoneId) throw new Error(`Akun pengirim ${senderRole === "bot" ? "Bot" : "Admin Utama"} belum dikonfigurasi`);

  const recipient = recipientType === "admin"
    ? normalizePhone(admin?.phoneNumber ?? "")
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
  const result = await sendMappedTemplate(senderPhoneId, recipient, rendered, {
    source: `notification:${eventKey}`,
    correlationId,
    ruleId: ruleId ?? undefined,
    templateId: template.id.startsWith("fallback-") ? undefined : template.id,
  });
  await writeActivityLog({
    customer: recipient,
    eventType: `notification.${result.success ? "sent" : "failed"}`,
    status: result.success ? "success" : "failed",
    message: result.success ? `${eventKey} berhasil dikirim` : result.error ?? `${eventKey} gagal dikirim`,
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

export async function emitNotification(input: EmitNotificationInput): Promise<EmitNotificationResult> {
  const fallback = FALLBACKS[input.eventKey];
  try {
    const { rule, tableMissing } = await getRule(input.eventKey);
    if (rule && !rule.is_active) return { status: "skipped", reason: "Rule dinonaktifkan" };
    if (!rule && !fallback) return { status: "skipped", reason: "Rule event belum tersedia" };

    const recipientType = rule?.recipient_type ?? fallback!.recipientType;
    const senderRole = recipientType === "admin" ? "bot" : rule?.sender_role ?? fallback!.senderRole;
    const route = await resolveRoute(recipientType, rule?.custom_recipient ?? null, senderRole, input.customerPhone);
    const template = rule?.template ?? fallback?.template;
    if (!template) return { status: "failed", error: "Pesan Tersimpan belum dipilih pada rule notifikasi" };
    const variables = { ...(rule?.variable_defaults ?? {}), ...input.variables };
    const delaySeconds = rule?.delay_seconds ?? fallback?.delaySeconds ?? 0;
    const maxAttempts = rule?.max_attempts ?? 3;
    const windowSeconds = rule?.dedupe_window_seconds ?? fallback?.dedupeWindowSeconds ?? 300;
    const bucket = Math.floor(Date.now() / Math.max(1000, windowSeconds * 1000));
    const dedupeKey = `${input.eventKey}:${input.dedupeId || route.recipient}:${input.dedupeId ? "event" : bucket}`;

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
      payload: { variables, fallback_template: rule?.template ? undefined : template },
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

export async function testNotificationRuleToAdmin(ruleId: string): Promise<EmitNotificationResult> {
  const { data, error } = await supabase.from("notification_rules").select("id,event_key,template:templates(*)").eq("id", ruleId).single();
  if (error || !data) return { status: "failed", error: error?.message ?? "Rule tidak ditemukan" };
  const accounts = await getDynamicAccounts();
  if (!accounts[1]?.phoneId || !accounts[0]?.phoneNumber) return { status: "failed", error: "Admin Utama dan Bot harus dikonfigurasi" };
  const template = data.template as unknown as TemplateData | null;
  if (!template) return { status: "failed", error: "Pesan Tersimpan belum dipilih" };
  const variables = {
    customer_name: "Customer Test", company_name: "PT Contoh", package_name: "Paket Highlight",
    amount: "150.000", order_id: "TEST-123", invoice_number: "INV-TEST-123",
    payment_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://infolokerjombang.net"}/pay/TEST-123`,
    invoice_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://infolokerjombang.net"}/admin/invoices/TEST-123`,
    scheduled_date: new Date().toLocaleDateString("id-ID"), poster_count: 1, customer_phone: accounts[0].phoneNumber,
  };
  return sendDirect(data.event_key, accounts[1].phoneId, normalizePhone(accounts[0].phoneNumber), template, variables, `test:${ruleId}:${Date.now()}`, ruleId);
}

export function formatRupiahValue(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toLocaleString("id-ID") : "0";
}
