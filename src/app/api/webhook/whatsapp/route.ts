import { NextRequest, NextResponse } from "next/server";
import {
  getAccountByPhone,
  getAccountByPhoneId,
  getAllAccounts,
  isAdminNumber,
} from "@/lib/whatsapp/kirimdev-client";
import { processCommand } from "@/lib/whatsapp/command-processor";
import type { KirimDevWebhookPayload } from "@/lib/whatsapp/types";
import { processCustomerMessage, processDueAutoReplyJobs } from "@/services/whatsapp-execution-engine";
import {
  claimWebhookEvent,
  recordProviderDeliveryStatus,
  writeWebhookLog,
} from "@/services/whatsapp-audit-service";

interface ParsedInboundMessage {
  senderPhone: string;
  text: string;
  phoneId: string;
  displayPhone: string;
}

interface ParsedMessageStatus {
  customer: string;
  messageId: string;
  status: string;
  error?: unknown;
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
  };
}

function parseLegacyInbound(payload: KirimDevWebhookPayload): ParsedInboundMessage | null {
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return null;
  const message = data.message as Record<string, unknown> | undefined;
  const textObject = data.text as Record<string, unknown> | undefined;
  const text = message?.text ?? textObject?.body ?? data.text;
  if (typeof data.from !== "string" || typeof text !== "string") return null;
  return {
    senderPhone: data.from,
    text,
    phoneId: typeof data.phoneId === "string" ? data.phoneId : "",
    displayPhone: typeof data.to === "string" ? data.to : "",
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

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const rawBody = await req.text();
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
  void processDueAutoReplyJobs(5).catch((error) => console.error("[Webhook] Queue worker gagal:", error));

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

  // Pesan admin yang bukan keyword tetap diteruskan ke command processor lama.
  if (await isAdminNumber(inbound.senderPhone)) {
    const account = phoneId ? await getAccountByPhoneId(phoneId) : undefined;
    try {
      await processCommand(phoneId, inbound.senderPhone, text);
    } catch (error) {
      console.error("[Webhook] Command processing failed:", error);
    }
    return NextResponse.json({
      status: "ok",
      type: "admin_command",
      command: text.split(/\s+/)[0],
      via: account?.label ?? "Unknown",
    });
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
