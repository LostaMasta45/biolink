import { createClient } from "@supabase/supabase-js";
import type { ActivityStatus, WebhookDirection, WebhookStatus } from "@/types/whatsapp-manager";
import { recordInboxOutboundAttempt } from "@/services/whatsapp-inbox-store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export interface ActivityAuditInput {
  customer: string;
  eventType: string;
  status: ActivityStatus;
  message?: string | null;
  automationId?: string | null;
  templateId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeActivityLog(input: ActivityAuditInput): Promise<void> {
  const { error } = await supabase.from("logs").insert({
    customer: input.customer || "unknown",
    event_type: input.eventType,
    status: input.status,
    message: input.message ?? null,
    automation_id: input.automationId ?? null,
    template_id: input.templateId ?? null,
    metadata: input.metadata ?? {},
  });
  if (error) console.error("[WhatsAppAudit] Activity log gagal:", error.message);
}

export async function writeWebhookLog(
  direction: WebhookDirection,
  eventType: string,
  status: WebhookStatus,
  payload: unknown,
  latencyMs = 0,
  retryCount = 0,
): Promise<void> {
  const { error } = await supabase.from("webhook_logs").insert({
    direction,
    event_type: eventType,
    status,
    payload: payload && typeof payload === "object" ? payload : { value: payload },
    latency_ms: Math.max(0, latencyMs),
    retry_count: Math.max(0, retryCount),
  });
  if (error) console.error("[WhatsAppAudit] Webhook log gagal:", error.message);
}

export async function claimWebhookEvent(eventId: string, eventType: string): Promise<boolean> {
  if (!eventId) return true;
  const { error } = await supabase.from("webhook_event_receipts").insert({
    event_id: eventId,
    event_type: eventType,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(`Deduplikasi webhook gagal: ${error.message}`);
}

export interface ApiSendAuditInput {
  customer: string;
  senderPhoneId: string;
  messageType: string;
  success: boolean;
  httpStatus?: number;
  latencyMs: number;
  providerMessageId?: string;
  providerStatus?: string;
  error?: string;
  source?: string;
  correlationId?: string;
  ruleId?: string;
  templateId?: string;
  response?: unknown;
}

export async function auditApiSend(input: ApiSendAuditInput): Promise<void> {
  const readReceipt = input.messageType === "read_receipt";
  // HTTP 2xx dari KirimDev hanya berarti pesan diterima provider. Untuk pesan
  // outbound, keberhasilan akhir baru dicatat saat webhook message.status
  // berstatus delivered/read diterima.
  const status: ActivityStatus = input.success ? (readReceipt ? "success" : "pending") : "failed";
  const metadata = {
    source: input.source ?? "direct_api",
    correlation_id: input.correlationId ?? null,
    rule_id: input.ruleId ?? null,
    sender_phone_id: input.senderPhoneId,
    message_type: input.messageType,
    provider_message_id: input.providerMessageId ?? null,
    provider_status: input.providerStatus ?? null,
    http_status: input.httpStatus ?? null,
    latency_ms: input.latencyMs,
    provider_response: input.response ?? null,
  };

  await Promise.all([
    writeActivityLog({
      customer: input.customer,
      eventType: readReceipt ? "api.message.read" : "api.message.send",
      status,
      message: input.success
        ? (readReceipt
          ? "KirimDev menerima penandaan pesan sudah dibaca"
          : `KirimDev menerima pengiriman ${input.messageType}; menunggu status delivery`)
        : `KirimDev menolak pengiriman ${input.messageType}: ${input.error ?? "unknown error"}`,
      templateId: input.templateId ?? null,
      metadata,
    }),
    writeWebhookLog(
      "outgoing",
      readReceipt
        ? (input.success ? "api.message.read" : "api.message.read_failed")
        : (input.success ? "api.message.accepted" : "api.message.failed"),
      input.success ? "success" : "failed",
      { customer: input.customer, error: input.error ?? null, ...metadata },
      input.latencyMs,
    ),
  ]);

  // Inbox adalah read model lokal. Kegagalannya tidak boleh membatalkan hasil
  // pengiriman yang sudah diterima/ditolak KirimDev, tetapi tetap terlihat di log server.
  if (!readReceipt) {
    try {
      await recordInboxOutboundAttempt({
        phoneId: input.senderPhoneId,
        customer: input.customer,
        providerMessageId: input.providerMessageId,
        success: input.success,
        source: input.source,
        correlationId: input.correlationId,
        error: input.error,
      });
    } catch (inboxError) {
      console.error("[WhatsAppAudit] Outbound Inbox gagal dicatat:", inboxError instanceof Error ? inboxError.message : inboxError);
    }
  }
}

export async function recordProviderDeliveryStatus(input: {
  customer: string;
  providerMessageId: string;
  providerStatus: string;
  error?: unknown;
  eventId?: string | null;
}): Promise<void> {
  const providerStatus = input.providerStatus.trim().toLowerCase();
  const failed = ["failed", "undelivered", "error"].includes(providerStatus);
  const delivered = ["delivered", "read", "played"].includes(providerStatus);
  const status: ActivityStatus = failed ? "failed" : delivered ? "success" : "pending";
  await writeActivityLog({
    customer: input.customer,
    eventType: "api.message.status",
    status,
    message: `Status pesan KirimDev: ${providerStatus}`,
    metadata: {
      provider_message_id: input.providerMessageId,
      provider_status: providerStatus,
      event_id: input.eventId ?? null,
      error: input.error ?? null,
    },
  });

  const providerError = typeof input.error === "string"
    ? input.error
    : JSON.stringify(input.error ?? `Provider reported ${providerStatus}`);

  const flowStepRequest = failed || delivered
    ? supabase
      .from("flow_run_steps")
      .update(failed ? { status: "failed", error: providerError } : { status: providerStatus === "played" ? "delivered" : providerStatus })
      .eq("provider_message_id", input.providerMessageId)
      .select("id,run_id,node_id")
    : Promise.resolve({ data: [] as Array<{ id: string; run_id: string; node_id: string | null }>, error: null });

  const [autoReplyResult, notificationResult, flowStepResult] = await Promise.all([
    supabase
      .from("auto_reply_jobs")
      .update(failed ? { status: "failed", last_error: providerError } : { last_error: null })
      .eq("provider_message_id", input.providerMessageId)
      .select("id,rule_id,template_id,customer"),
    supabase
      .from("notification_jobs")
      .update(failed ? { status: "failed", last_error: providerError } : { last_error: null })
      .eq("provider_message_id", input.providerMessageId)
      .select("id,event_key,template_id,recipient"),
    flowStepRequest,
  ]);

  if (autoReplyResult.error) console.error("[WhatsAppAudit] Status auto reply gagal diperbarui:", autoReplyResult.error.message);
  if (notificationResult.error) console.error("[WhatsAppAudit] Status notifikasi gagal diperbarui:", notificationResult.error.message);
  if (flowStepResult.error) console.error("[WhatsAppAudit] Status step flow gagal diperbarui:", flowStepResult.error.message);

  const autoReplies = autoReplyResult.data ?? [];
  const notifications = notificationResult.data ?? [];
  const flowSteps = flowStepResult.data ?? [];
  if (failed && flowSteps.length) {
    await Promise.all(flowSteps.map((step) => supabase.from("flow_runs").update({
      status: "failed",
      last_error: providerError,
      completed_at: new Date().toISOString(),
    }).eq("id", step.run_id).in("status", ["active", "waiting"])));
  }
  if (!failed && !delivered) return;

  await Promise.all([
    ...autoReplies.map((job) => writeActivityLog({
      customer: job.customer,
      eventType: `auto_reply.${failed ? "delivery_failed" : providerStatus}`,
      status,
      templateId: job.template_id,
      message: failed ? `Auto reply gagal di provider: ${providerError}` : `Auto reply ${providerStatus} oleh provider`,
      metadata: { job_id: job.id, rule_id: job.rule_id, provider_message_id: input.providerMessageId, provider_status: providerStatus, error: input.error ?? null },
    })),
    ...notifications.map((job) => writeActivityLog({
      customer: job.recipient,
      eventType: `notification.${failed ? "delivery_failed" : providerStatus}`,
      status,
      templateId: job.template_id,
      message: failed ? `Notifikasi gagal di provider: ${providerError}` : `Notifikasi ${providerStatus} oleh provider`,
      metadata: { job_id: job.id, event_key: job.event_key, provider_message_id: input.providerMessageId, provider_status: providerStatus, error: input.error ?? null },
    })),
    ...flowSteps.map((step) => writeActivityLog({
      customer: input.customer,
      eventType: `flow.node.${failed ? "delivery_failed" : providerStatus}`,
      status,
      message: failed ? `Node flow gagal di provider: ${providerError}` : `Node flow ${providerStatus} oleh provider`,
      metadata: { flow_run_id: step.run_id, step_id: step.id, node_id: step.node_id, provider_message_id: input.providerMessageId, provider_status: providerStatus, error: input.error ?? null },
    })),
  ]);
}

export { supabase as whatsappAdminClient };
