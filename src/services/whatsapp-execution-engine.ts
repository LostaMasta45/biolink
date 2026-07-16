import { normalizeAutoReplyKeyword } from "@/lib/whatsapp/auto-reply-keyword";
import { sendMappedTemplate, type TemplateData } from "./kirimdev-mapper";
import {
  whatsappAdminClient as supabase,
  writeActivityLog,
  writeWebhookLog,
} from "./whatsapp-audit-service";

type MatchType = "equals" | "contains" | "starts_with";
type ScheduleMode = "always" | "business_hours" | "outside_hours";
type SkipReason = "cooldown" | "test_mode" | "schedule" | "handover";

interface AutoReplyRow {
  id: string;
  keyword: string;
  template_id: string;
  match_type: MatchType;
  delay_seconds: number;
  cooldown_seconds: number;
  priority: number;
  schedule_mode: ScheduleMode;
  handover_to_human: boolean;
  handover_duration_minutes: number;
  is_test_mode: boolean;
  test_phone_numbers: string[];
  created_at: string;
  template: (TemplateData & { is_active?: boolean }) | null;
}

interface RuntimeSettings {
  timezone: string;
  retry_count: number;
  default_delay: number;
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
}

interface AutoReplyJobRow {
  id: string;
  rule_id: string;
  template_id: string;
  customer: string;
  sender_phone_id: string;
  payload: { keyword?: string; text_received?: string; event_id?: string | null };
  attempts: number;
  max_attempts: number;
  template: TemplateData | null;
}

export type CustomerMessageResult =
  | { status: "sent"; ruleId: string; templateId: string; jobId: string }
  | { status: "queued"; ruleId: string; templateId: string; jobId: string; scheduledAt: string }
  | { status: "simulated"; ruleId: string; templateId: string; keyword: string; templateName: string; delaySeconds: number }
  | { status: "skipped"; reason: SkipReason }
  | { status: "no_match" }
  | { status: "failed"; error: string };

const DEFAULT_SETTINGS: RuntimeSettings = {
  timezone: "Asia/Jakarta",
  retry_count: 3,
  default_delay: 0,
  business_hours_enabled: false,
  business_hours_start: "08:00",
  business_hours_end: "17:00",
  business_days: [1, 2, 3, 4, 5, 6],
};

function getAdminPhoneId(): string {
  return process.env.KIRIMDEV_PHONE_ID_1 || process.env.KIRIMDEV_PHONE_ID || "";
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits ? `62${digits}` : "";
}

function ruleMatches(rule: AutoReplyRow, normalizedText: string): boolean {
  const keyword = normalizeAutoReplyKeyword(rule.keyword);
  if (!keyword) return false;
  if (rule.match_type === "contains") return normalizedText.includes(keyword);
  if (rule.match_type === "starts_with") return normalizedText.startsWith(keyword);
  return normalizedText === keyword;
}

const MATCH_ORDER: Record<MatchType, number> = { equals: 3, starts_with: 2, contains: 1 };

function selectBestRule(rules: AutoReplyRow[], normalizedText: string): AutoReplyRow | undefined {
  return rules
    .filter((rule) => ruleMatches(rule, normalizedText))
    .sort((left, right) =>
      MATCH_ORDER[right.match_type] - MATCH_ORDER[left.match_type]
      || right.priority - left.priority
      || left.created_at.localeCompare(right.created_at)
    )[0];
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function isInsideBusinessHours(settings: RuntimeSettings, now = new Date()): boolean {
  if (!settings.business_hours_enabled) return true;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: settings.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[values.weekday ?? "Sun"] ?? 0;
  if (!settings.business_days.includes(day)) return false;
  const current = Number(values.hour ?? 0) * 60 + Number(values.minute ?? 0);
  const start = timeToMinutes(settings.business_hours_start);
  const end = timeToMinutes(settings.business_hours_end);
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function scheduleAllows(rule: AutoReplyRow, settings: RuntimeSettings): boolean {
  if (rule.schedule_mode === "always") return true;
  const inside = isInsideBusinessHours(settings);
  return rule.schedule_mode === "business_hours" ? inside : !inside;
}

async function getSettings(): Promise<RuntimeSettings> {
  const { data, error } = await supabase
    .from("settings")
    .select("timezone,retry_count,default_delay,business_hours_enabled,business_hours_start,business_hours_end,business_days")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(`Settings automation tidak dapat dibaca: ${error.message}`);
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as RuntimeSettings;
}

async function hasActiveHandover(customer: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("whatsapp_handover_sessions")
    .select("customer")
    .eq("customer", customer)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`Status handover tidak dapat dibaca: ${error.message}`);
  return Boolean(data);
}

async function logSkipped(customer: string, reason: SkipReason, metadata: Record<string, unknown>) {
  await writeActivityLog({
    customer,
    eventType: `auto_reply.skipped_${reason}`,
    status: "skipped",
    message: `Auto reply dilewati: ${reason}`,
    metadata,
  });
}

async function processAutoReplyJob(jobId: string): Promise<{ sent: boolean; error?: string }> {
  const { data: claimed, error: claimError } = await supabase
    .from("auto_reply_jobs")
    .update({ status: "processing" })
    .eq("id", jobId)
    .in("status", ["queued", "retry"])
    .select("id,rule_id,template_id,customer,sender_phone_id,payload,attempts,max_attempts,template:templates(*)")
    .maybeSingle();
  if (claimError) return { sent: false, error: claimError.message };
  if (!claimed) return { sent: false, error: "Job sudah diproses worker lain" };

  const job = claimed as unknown as AutoReplyJobRow;
  if (!job.template) {
    await supabase.from("auto_reply_jobs").update({ status: "failed", last_error: "Template tidak tersedia" }).eq("id", job.id);
    return { sent: false, error: "Template tidak tersedia" };
  }

  const attempt = job.attempts + 1;
  const result = await sendMappedTemplate(job.sender_phone_id, job.customer, job.template, {
    source: "auto_reply_worker",
    correlationId: job.id,
    ruleId: job.rule_id,
    templateId: job.template_id,
  });

  if (result.success) {
    await supabase.from("auto_reply_jobs").update({
      status: "sent",
      attempts: attempt,
      provider_message_id: result.messageId ?? null,
      last_error: null,
      sent_at: new Date().toISOString(),
    }).eq("id", job.id);
    await writeActivityLog({
      customer: job.customer,
      eventType: "auto_reply.sent",
      status: "success",
      message: `Template auto reply "${job.template.name}" berhasil dikirim`,
      templateId: job.template_id,
      metadata: { job_id: job.id, rule_id: job.rule_id, provider_message_id: result.messageId ?? null, attempt },
    });
    return { sent: true };
  }

  const canRetry = attempt < job.max_attempts;
  const retryAt = new Date(Date.now() + Math.min(300, 15 * (2 ** (attempt - 1))) * 1000).toISOString();
  await supabase.from("auto_reply_jobs").update({
    status: canRetry ? "retry" : "failed",
    attempts: attempt,
    scheduled_at: canRetry ? retryAt : new Date().toISOString(),
    last_error: result.error ?? "KirimDev menolak pengiriman",
  }).eq("id", job.id);
  await writeActivityLog({
    customer: job.customer,
    eventType: canRetry ? "auto_reply.retry" : "auto_reply.failed",
    status: canRetry ? "pending" : "failed",
    message: result.error ?? "KirimDev menolak pengiriman",
    templateId: job.template_id,
    metadata: { job_id: job.id, rule_id: job.rule_id, attempt, retry_at: canRetry ? retryAt : null },
  });
  return { sent: false, error: result.error };
}

export async function processDueAutoReplyJobs(limit = 25): Promise<{ processed: number; sent: number; failed: number }> {
  const { data, error } = await supabase
    .from("auto_reply_jobs")
    .select("id")
    .in("status", ["queued", "retry"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(`Antrean auto reply tidak dapat dibaca: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const result = await processAutoReplyJob(row.id);
    if (result.sent) sent += 1;
    else if (result.error !== "Job sudah diproses worker lain") failed += 1;
  }
  return { processed: data?.length ?? 0, sent, failed };
}

export async function processCustomerMessage(
  webhookPhoneId: string,
  senderPhone: string,
  text: string,
  options: { eventId?: string | null; dryRun?: boolean } = {},
): Promise<CustomerMessageResult> {
  const senderPhoneId = getAdminPhoneId() || webhookPhoneId;
  if (!senderPhoneId) return { status: "failed", error: "Phone ID Admin Utama belum dikonfigurasi" };

  const customer = normalizePhone(senderPhone);
  const normalizedText = normalizeAutoReplyKeyword(text);
  if (!normalizedText) return { status: "no_match" };

  try {
    const settings = await getSettings();
    if (!options.dryRun && await hasActiveHandover(customer)) {
      await logSkipped(customer, "handover", { text_received: text, event_id: options.eventId ?? null });
      return { status: "skipped", reason: "handover" };
    }

    const { data, error } = await supabase
      .from("auto_reply")
      .select("id,keyword,template_id,match_type,delay_seconds,cooldown_seconds,priority,schedule_mode,handover_to_human,handover_duration_minutes,is_test_mode,test_phone_numbers,created_at,template:templates(*)")
      .eq("is_active", true);
    if (error) throw new Error(`Rule auto reply tidak dapat dibaca: ${error.message}`);

    const rule = selectBestRule((data ?? []) as unknown as AutoReplyRow[], normalizedText);
    if (!rule) return { status: "no_match" };
    if (!rule.template || rule.template.is_active === false) {
      throw new Error(`Template untuk keyword "${rule.keyword}" tidak tersedia atau nonaktif`);
    }

    if (rule.is_test_mode && !rule.test_phone_numbers.map(normalizePhone).includes(customer)) {
      await logSkipped(customer, "test_mode", { rule_id: rule.id, keyword: rule.keyword });
      return { status: "skipped", reason: "test_mode" };
    }
    if (!scheduleAllows(rule, settings)) {
      await logSkipped(customer, "schedule", { rule_id: rule.id, keyword: rule.keyword, schedule_mode: rule.schedule_mode });
      return { status: "skipped", reason: "schedule" };
    }

    const delaySeconds = Math.max(0, rule.delay_seconds ?? settings.default_delay);
    if (options.dryRun) {
      return {
        status: "simulated",
        ruleId: rule.id,
        templateId: rule.template_id,
        keyword: rule.keyword,
        templateName: rule.template.name,
        delaySeconds,
      };
    }

    if (rule.cooldown_seconds > 0) {
      const since = new Date(Date.now() - rule.cooldown_seconds * 1000).toISOString();
      const { data: recent, error: cooldownError } = await supabase
        .from("auto_reply_jobs")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("customer", customer)
        .in("status", ["queued", "processing", "retry", "sent"])
        .gte("created_at", since)
        .limit(1);
      if (cooldownError) throw new Error(`Cooldown tidak dapat diperiksa: ${cooldownError.message}`);
      if ((recent?.length ?? 0) > 0) {
        await logSkipped(customer, "cooldown", { rule_id: rule.id, keyword: rule.keyword, cooldown_seconds: rule.cooldown_seconds });
        return { status: "skipped", reason: "cooldown" };
      }
    }

    const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const bucketMs = Math.max(1000, rule.cooldown_seconds * 1000);
    const dedupeKey = `${rule.id}:${customer}:${Math.floor(Date.now() / bucketMs)}`;
    const { data: job, error: jobError } = await supabase.from("auto_reply_jobs").insert({
      event_id: options.eventId ?? null,
      rule_id: rule.id,
      template_id: rule.template_id,
      customer,
      sender_phone_id: senderPhoneId,
      payload: { keyword: rule.keyword, text_received: text, event_id: options.eventId ?? null },
      scheduled_at: scheduledAt,
      status: "queued",
      max_attempts: Math.max(1, settings.retry_count || 3),
      dedupe_key: dedupeKey,
    }).select("id").single();
    if (jobError?.code === "23505") {
      await logSkipped(customer, "cooldown", { rule_id: rule.id, keyword: rule.keyword, dedupe_key: dedupeKey });
      return { status: "skipped", reason: "cooldown" };
    }
    if (jobError || !job) throw new Error(`Job auto reply gagal dibuat: ${jobError?.message ?? "unknown error"}`);

    if (rule.handover_to_human) {
      const expiresAt = new Date(Date.now() + rule.handover_duration_minutes * 60_000).toISOString();
      const { error: handoverError } = await supabase.from("whatsapp_handover_sessions").upsert({
        customer,
        rule_id: rule.id,
        reason: `Keyword ${rule.keyword}`,
        expires_at: expiresAt,
      });
      if (handoverError) console.error("[AutoReply] Handover gagal dicatat:", handoverError.message);
    }

    await writeActivityLog({
      customer,
      eventType: "auto_reply.queued",
      status: "pending",
      message: `Keyword "${rule.keyword}" cocok; pengiriman dijadwalkan`,
      templateId: rule.template_id,
      metadata: { job_id: job.id, rule_id: rule.id, match_type: rule.match_type, delay_seconds: delaySeconds, scheduled_at: scheduledAt },
    });

    if (delaySeconds === 0) {
      const execution = await processAutoReplyJob(job.id);
      if (!execution.sent) return { status: "failed", error: execution.error ?? "Pengiriman gagal" };
      return { status: "sent", ruleId: rule.id, templateId: rule.template_id, jobId: job.id };
    }
    return { status: "queued", ruleId: rule.id, templateId: rule.template_id, jobId: job.id, scheduledAt };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Automation gagal diproses";
    await writeActivityLog({
      customer,
      eventType: "auto_reply.failed",
      status: "failed",
      message: error,
      metadata: { text_received: text, event_id: options.eventId ?? null },
    });
    return { status: "failed", error };
  }
}

export const logWebhookEvent = writeWebhookLog;
