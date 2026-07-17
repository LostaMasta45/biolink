import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getAccountByPhone,
  getAllAccounts,
  isAdminNumber,
  markMessageAsRead,
} from "@/lib/whatsapp/kirimdev-client";
import { processCommand } from "@/lib/whatsapp/command-processor";
import type { KirimDevWebhookPayload } from "@/lib/whatsapp/types";
import { processCustomerMessage, processDueAutoReplyJobs } from "@/services/whatsapp-execution-engine";
import { processDueNotificationJobs } from "@/services/whatsapp-notification-service";
import { processFlowTriggers, recordCustomerActivity } from "@/services/whatsapp-flow-engine";
import {
  claimWebhookEvent,
  recordProviderDeliveryStatus,
  whatsappAdminClient,
  writeWebhookLog,
} from "@/services/whatsapp-audit-service";

interface ParsedInboundMessage {
  senderPhone: string;
  text: string;
  phoneId: string;
  displayPhone: string;
  messageId: string;
}

interface ParsedMessageStatus {
  customer: string;
  messageId: string;
  status: string;
  error?: unknown;
}

interface ParsedNativeFlowEvent {
  triggerType: "chat_started" | "conversation_closed" | "conversation_assigned" | "label_added";
  customer: string;
  phoneId: string;
  labels: string[];
}

function verifyKirimSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secrets = (process.env.KIRIMDEV_WEBHOOK_SECRETS || process.env.KIRIMDEV_WEBHOOK_SECRET || "")
    .split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
  if (!secrets.length || !signatureHeader) return false;

  const values = signatureHeader.split(",").map((part) => part.trim()).filter(Boolean);
  const timestamp = values.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = values
    .map((part) => part.startsWith("v1=") ? part.slice(3) : part)
    .filter((signature) => /^[a-f0-9]{64}$/i.test(signature));
  if (!signatures.length) return false;

  const matches = (signedPayload: string) => secrets.some((secret) => {
    const expected = Buffer.from(createHmac("sha256", secret).update(signedPayload).digest("hex"), "hex");
    return signatures.some((signature) => {
      const received = Buffer.from(signature, "hex");
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
  });

  // KirimDev saat ini menandatangani raw body langsung. Tetap terima format
  // timestamp lama selama masih segar agar rotasi deployment tidak memutus webhook.
  if (matches(rawBody)) return true;
  const timestampSeconds = Number(timestamp);
  return Boolean(timestamp)
    && Number.isFinite(timestampSeconds)
    && Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= 300
    && matches(`${timestamp}.${rawBody}`);
}

function parseMetaInbound(payload: KirimDevWebhookPayload): ParsedInboundMessage | null {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  if (!message) return null;

  let text = "";
  if (message.type === "text") {
    text = message.text?.body ?? "";
  } else if (message.type === "interactive") {
    text = message.interactive?.button_reply?.id
      ?? message.interactive?.list_reply?.id
      ?? "";
  } else if (message.type === "button") {
    const button = message as typeof message & { button?: { payload?: string; text?: string } };
    text = button.button?.payload ?? button.button?.text ?? "";
  }

  if (!message.from || !text) return null;
  return {
    senderPhone: message.from,
    text,
    phoneId: value?.metadata?.phone_number_id ?? "",
    displayPhone: value?.metadata?.display_phone_number ?? "",
    messageId: message.id ?? "",
  };
}

function parseLegacyInbound(payload: KirimDevWebhookPayload): ParsedInboundMessage | null {
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const message = data.message as Record<string, unknown> | undefined;
  const textObject = data.text as Record<string, unknown> | undefined;
  const messageText = message?.text;
  const nestedText = messageText && typeof messageText === "object" ? (messageText as Record<string, unknown>).body : messageText;
  const interactive = (message?.interactive ?? data.interactive) as Record<string, unknown> | undefined;
  const buttonReply = interactive?.button_reply as Record<string, unknown> | undefined;
  const listReply = interactive?.list_reply as Record<string, unknown> | undefined;
  const button = (message?.button ?? data.button) as Record<string, unknown> | undefined;
  const text = nestedText ?? textObject?.body ?? buttonReply?.id ?? listReply?.id ?? button?.payload ?? button?.text ?? data.text;
  if (typeof data.from !== "string" || typeof text !== "string") return null;
  return {
    senderPhone: data.from,
    text,
    phoneId: typeof data.phoneId === "string" ? data.phoneId : "",
    displayPhone: typeof data.to === "string" ? data.to : "",
    messageId: typeof data.id === "string" ? data.id : "",
  };
}

function parseMessageStatus(payload: KirimDevWebhookPayload): ParsedMessageStatus | null {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const status = value?.statuses?.[0] as Record<string, unknown> | undefined;
  if (!status || typeof status.id !== "string" || typeof status.status !== "string") {
    const legacy = payload.data;
    if (legacy?.id && legacy.status) {
      return { customer: legacy.to || "unknown", messageId: legacy.id, status: legacy.status };
    }
    return null;
  }
  return {
    customer: typeof status.recipient_id === "string" ? status.recipient_id : "unknown",
    messageId: status.id,
    status: status.status,
    error: status.errors ?? null,
  };
}

function inferEventId(payload: KirimDevWebhookPayload): string {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const receivedId = value?.messages?.[0]?.id;
  const statusId = (value?.statuses?.[0] as { id?: string } | undefined)?.id;
  return receivedId ?? statusId ?? payload.data?.id ?? "";
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function parseNativeFlowEvent(eventType: string, payload: KirimDevWebhookPayload): ParsedNativeFlowEvent | null {
  const mapping: Record<string, ParsedNativeFlowEvent["triggerType"]> = {
    "contact.created": "chat_started",
    "conversation.closed": "conversation_closed",
    "conversation.assigned": "conversation_assigned",
    "contact.updated": "label_added",
  };
  const triggerType = mapping[eventType];
  if (!triggerType) return null;
  const data = recordFromUnknown(payload.data);
  const contact = recordFromUnknown(data.contact);
  const conversation = recordFromUnknown(data.conversation);
  const conversationContact = recordFromUnknown(conversation.contact);
  const customer = [
    contact.phone_number, contact.phone, contact.wa_id,
    conversationContact.phone_number, conversationContact.phone,
    data.phone_number, data.customer_phone, data.from,
  ].find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
  const phoneId = [data.session, data.phone_number_id, data.phoneId, conversation.phone_number_id].find((value): value is string => typeof value === "string" && value.length > 0) ?? "";
  const rawLabels = [contact.labels, data.labels, conversation.labels].find(Array.isArray) as unknown[] | undefined;
  const labels = (rawLabels ?? []).map((label) => {
    if (typeof label === "string") return label;
    const row = recordFromUnknown(label);
    return typeof row.name === "string" ? row.name : typeof row.label === "string" ? row.label : "";
  }).filter(Boolean);
  return customer ? { triggerType, customer, phoneId, labels } : null;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await req.text();
  if (!verifyKirimSignature(rawBody, req.headers.get("x-kirim-signature"))) {
    await writeWebhookLog("incoming", "webhook.invalid_signature", "failed", { reason: "signature_missing_or_invalid" }, Date.now() - startedAt);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }
  let payload: KirimDevWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as KirimDevWebhookPayload;
  } catch {
    await writeWebhookLog("incoming", "invalid_json", "failed", { raw_preview: rawBody.slice(0, 500) }, Date.now() - startedAt);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payloadType = (payload as KirimDevWebhookPayload & { type?: string }).type;
  const eventType = req.headers.get("x-kirim-event")
    || payload.event
    || payloadType
    || (payload.entry ? "meta.webhook" : "unknown");
  const eventId = req.headers.get("x-kirim-event-id") || inferEventId(payload);
  const dedupeEventId = eventId ? `${eventType}:${eventId}` : "";

  await writeWebhookLog("incoming", eventType, "success", payload, Date.now() - startedAt);

  try {
    const claimed = await claimWebhookEvent(dedupeEventId, eventType);
    if (!claimed) {
      await writeWebhookLog("incoming", `${eventType}.duplicate`, "retry", { event_id: eventId }, Date.now() - startedAt, 1);
      return NextResponse.json({ status: "ok", action: "duplicate_ignored", event: eventType });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deduplikasi webhook gagal";
    await writeWebhookLog("incoming", `${eventType}.dedupe_failed`, "failed", { event_id: eventId, error: message }, Date.now() - startedAt);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }

  // Setiap webhook ikut membantu menguras job yang sudah jatuh tempo. Worker cron
  // tetap menjadi jalur utama untuk delay ketika tidak ada event baru.
  void Promise.all([processDueAutoReplyJobs(5), processDueNotificationJobs(5)])
    .catch((error) => console.error("[Webhook] Queue worker gagal:", error));

  if (eventType === "message.status") {
    const status = parseMessageStatus(payload);
    if (status) {
      await recordProviderDeliveryStatus({
        customer: status.customer,
        providerMessageId: status.messageId,
        providerStatus: status.status,
        error: status.error,
        eventId,
      });
      await writeWebhookLog("outgoing", `message.${status.status}`, status.status === "failed" ? "failed" : "success", {
        event_id: eventId,
        provider_message_id: status.messageId,
        customer: status.customer,
        error: status.error ?? null,
      }, Date.now() - startedAt);
    }
    return NextResponse.json({ status: "ok", action: status ? "delivery_status_recorded" : "status_ignored" });
  }

  const nativeFlowEvent = parseNativeFlowEvent(eventType, payload);
  if (nativeFlowEvent) {
    const accounts = await getAllAccounts();
    const senderPhoneId = nativeFlowEvent.phoneId || accounts[0]?.phoneId || "";
    if (!senderPhoneId) return NextResponse.json({ status: "error", action: "flow_trigger_failed", error: "Phone ID Admin Utama belum dikonfigurasi" }, { status: 500 });
    const result = await processFlowTriggers({
      type: nativeFlowEvent.triggerType,
      customerPhone: nativeFlowEvent.customer,
      senderPhoneId,
      eventId,
      labels: nativeFlowEvent.labels,
    });
    await writeWebhookLog("outgoing", `flow.trigger.${nativeFlowEvent.triggerType}`, result.handled && result.status === "failed" ? "failed" : "success", {
      event_id: eventId,
      customer: nativeFlowEvent.customer,
      labels: nativeFlowEvent.labels,
      flow_run_id: result.handled && result.status !== "failed" ? result.runId : null,
      error: result.handled && result.status === "failed" ? result.error : null,
    }, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", action: result.handled ? "flow_trigger_processed" : "flow_trigger_ignored" });
  }

  // message.sent dan message.status bukan pesan customer. Mengabaikannya mencegah
  // balasan kita sendiri masuk lagi ke engine dan membuat loop.
  if (eventType !== "message.received" && eventType !== "meta.webhook") {
    return NextResponse.json({ status: "ok", action: "ignored_event", event: eventType });
  }

  const inbound = parseMetaInbound(payload) ?? parseLegacyInbound(payload);
  if (!inbound) {
    return NextResponse.json({ status: "ok", action: "ignored_non_text", event: eventType });
  }

  let phoneId = inbound.phoneId;
  if (!phoneId && inbound.displayPhone) {
    phoneId = (await getAccountByPhone(inbound.displayPhone))?.phoneId ?? "";
  }
  if (!phoneId) {
    phoneId = (await getAllAccounts())[0]?.phoneId ?? "";
  }

  const text = inbound.text.trim();
  await recordCustomerActivity({ customerPhone: inbound.senderPhone, senderPhoneId: phoneId, eventId, text });
  if (inbound.messageId.startsWith("wamid.")) {
    const { data: receiptSettings, error: receiptError } = await whatsappAdminClient
      .from("settings")
      .select("auto_mark_read,show_typing_indicator")
      .eq("id", true)
      .maybeSingle();
    if (receiptError) {
      console.warn("[Webhook] Read-receipt settings belum tersedia:", receiptError.message);
    } else if (receiptSettings?.auto_mark_read) {
      const receipt = await markMessageAsRead(
        phoneId,
        inbound.messageId,
        inbound.senderPhone,
        Boolean(receiptSettings.show_typing_indicator),
      );
      if (!receipt.success) console.warn("[Webhook] Mark as read gagal:", receipt.error);
    }
  }

  const accounts = await getAllAccounts();
  const botAccount = accounts[1];
  const senderIsAdmin = await isAdminNumber(inbound.senderPhone);

  // Command dan jawaban state-machine hanya boleh melalui Admin Utama -> Bot.
  if (senderIsAdmin) {
    if (!botAccount?.phoneId || phoneId !== botAccount.phoneId) {
      await writeWebhookLog("incoming", "admin_command.wrong_account", "success", { event_id: eventId, phone_id: phoneId });
      return NextResponse.json({ status: "ok", action: "admin_command_ignored", reason: "commands_must_be_sent_to_bot" });
    }
    try {
      const handled = await processCommand(phoneId, inbound.senderPhone, text);
      return NextResponse.json({ status: "ok", type: "admin_command", handled, command: text.split(/\s+/)[0], via: botAccount.label });
    } catch (error) {
      console.error("[Webhook] Command processing failed:", error);
      return NextResponse.json({ status: "error", action: "admin_command_failed" }, { status: 500 });
    }
  }

  // Nomor Bot tidak melayani customer; seluruh customer service tetap melalui Admin Utama.
  if (botAccount?.phoneId && phoneId === botAccount.phoneId) {
    return NextResponse.json({ status: "ok", action: "ignored_customer_on_admin_bot" });
  }

  const execution = await processCustomerMessage(phoneId, inbound.senderPhone, text, { eventId });

  if (execution.status === "failed") {
    await writeWebhookLog("outgoing", "auto_reply.failed", "failed", {
      event_id: eventId,
      error: execution.error,
    });
    // KirimDev akan retry webhook non-2xx, sehingga gangguan DB/API sementara tidak
    // menghilangkan pesan customer tanpa jejak.
    return NextResponse.json(
      { status: "error", action: "auto_reply_failed", error: execution.error },
      { status: 500 },
    );
  }

  if (execution.status === "flow_waiting" || execution.status === "flow_completed") {
    await writeWebhookLog("outgoing", `flow.${execution.status}`, "success", {
      event_id: eventId,
      flow_id: execution.flowId,
      flow_run_id: execution.runId,
      node_id: execution.nodeId ?? null,
    }, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", action: execution.status, flow_run_id: execution.runId });
  }

  if (execution.status === "sent") {
    await writeWebhookLog("outgoing", "auto_reply.sent", "success", {
      event_id: eventId,
      rule_id: execution.ruleId,
      template_id: execution.templateId,
    });
    return NextResponse.json({ status: "ok", action: "auto_reply_sent" });
  }

  if (execution.status === "queued") {
    await writeWebhookLog("outgoing", "auto_reply.queued", "success", {
      event_id: eventId,
      job_id: execution.jobId,
      rule_id: execution.ruleId,
      scheduled_at: execution.scheduledAt,
    }, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", action: "auto_reply_queued", scheduled_at: execution.scheduledAt });
  }

  if (execution.status === "skipped") {
    await writeWebhookLog("outgoing", `auto_reply.skipped_${execution.reason}`, "success", {
      event_id: eventId,
      reason: execution.reason,
    }, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", action: "auto_reply_skipped", reason: execution.reason });
  }

  return NextResponse.json({ status: "ok", type: "customer", action: "no_keyword_match" });
}

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get("challenge");
  if (challenge) return new NextResponse(challenge, { status: 200 });

  const accounts = await getAllAccounts();
  return NextResponse.json({
    status: "active",
    service: "ILJ-Hub WhatsApp Webhook",
    timestamp: new Date().toISOString(),
    accounts: accounts.map((account) => ({
      label: account.label,
      phoneId: account.phoneId ? `***${account.phoneId.slice(-4)}` : "N/A",
    })),
  });
}
