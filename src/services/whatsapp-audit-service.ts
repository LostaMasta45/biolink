import { createClient } from "@supabase/supabase-js";
import type { ActivityStatus, WebhookDirection, WebhookStatus } from "@/types/whatsapp-manager";

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
  const status: ActivityStatus = input.success ? "success" : "failed";
  const readReceipt = input.messageType === "read_receipt";
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
        ? `KirimDev menerima pengiriman ${input.messageType}`
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
}

export async function recordProviderDeliveryStatus(input: {
  customer: string;
  providerMessageId: string;
  providerStatus: string;
  error?: unknown;
  eventId?: string | null;
}): Promise<void> {
  const failed = input.providerStatus === "failed";
  const pending = ["accepted", "sent", "pending"].includes(input.providerStatus);
  await writeActivityLog({
    customer: input.customer,
    eventType: "api.message.status",
    status: failed ? "failed" : pending ? "pending" : "success",
    message: `Status pesan KirimDev: ${input.providerStatus}`,
    metadata: {
      provider_message_id: input.providerMessageId,
      provider_status: input.providerStatus,
      event_id: input.eventId ?? null,
      error: input.error ?? null,
    },
  });

  if (failed) {
    await supabase
      .from("auto_reply_jobs")
      .update({ last_error: JSON.stringify(input.error ?? "Provider reported failed") })
      .eq("provider_message_id", input.providerMessageId);
  }
}

export { supabase as whatsappAdminClient };
