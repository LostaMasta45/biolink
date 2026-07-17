import { listKirimDevResourcePage } from "@/lib/whatsapp/kirimdev-client";
import {
  getInboxSyncState,
  persistInboxInbound,
  persistInboxOutbound,
  saveInboxSyncState,
  type InboxAccount,
  upsertInboxProviderContact,
  upsertInboxProviderConversation,
} from "@/services/whatsapp-inbox-store";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function messageBody(message: Record<string, unknown>) {
  if (typeof message.body === "string") return message.body;
  // The list endpoint returns `content` as a plain string for text messages.
  // Some message kinds serialize it as JSON, therefore support both forms.
  if (typeof message.content === "string") {
    const raw = message.content.trim();
    if (!raw.startsWith("{") && !raw.startsWith("[")) return raw;
    try {
      const parsed = record(JSON.parse(raw));
      if (typeof parsed.body === "string") return parsed.body;
      if (typeof parsed.text === "string") return parsed.text;
      const text = record(parsed.text);
      if (typeof text.body === "string") return text.body;
      if (typeof parsed.caption === "string") return parsed.caption;
    } catch { return raw; }
  }
  const content = record(message.content);
  if (typeof content.body === "string") return content.body;
  if (typeof content.text === "string") return content.text;
  return "";
}

async function processConcurrent<T>(values: T[], worker: (value: T) => Promise<boolean>, concurrency = 8) {
  let next = 0;
  let processed = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      if (await worker(values[index])) processed += 1;
    }
  }));
  return processed;
}

async function syncMessagesPage(account: InboxAccount, cursor?: string | null) {
  const page = await listKirimDevResourcePage(account.phone_number_id, "messages", cursor);
  const processed = await processConcurrent(page.data, async (raw) => {
    const message = record(raw);
    const direction = string(message.direction).toLowerCase();
    const providerMessageId = string(message.provider_id) || string(message.wamid) || string(message.id);
    const type = string(message.type) || "text";
    const createdAt = string(message.created_at) || string(message.timestamp) || undefined;
    const source = string(message.source) || "provider";
    if (!providerMessageId) return false;
    if (direction === "inbound") {
      // KirimDev's history endpoint represents the peer as `to` for both
      // inbound and outbound rows; `from` is only present in Meta webhooks.
      const customer = string(message.from) || string(message.to) || string(message.contact_phone_number) || string(message.bsuid);
      if (!customer) return false;
      await persistInboxInbound({
        phoneId: account.phone_number_id,
        phoneNumber: account.phone_number,
        customer,
        providerMessageId,
        body: messageBody(message),
        messageType: type,
        providerCreatedAt: createdAt,
        payload: { provider_id: string(message.id), sync: true },
      });
      return true;
    } else if (direction === "outbound") {
      const customer = string(message.to) || string(message.recipient) || string(message.bsuid);
      if (!customer) return false;
      await persistInboxOutbound({
        phoneId: account.phone_number_id,
        phoneNumber: account.phone_number,
        customer,
        providerMessageId,
        body: messageBody(message),
        messageType: type,
        source,
        providerCreatedAt: createdAt,
        payload: { provider_id: string(message.id), sync: true },
      });
      return true;
    }
    return false;
  });
  return { processed, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

async function syncContactsPage(account: InboxAccount, cursor?: string | null) {
  const page = await listKirimDevResourcePage(account.phone_number_id, "contacts", cursor);
  const processed = await processConcurrent(page.data, async (raw) => {
    const contact = record(raw);
    const phone = string(contact.phone_number) || string(contact.phone) || string(contact.wa_id);
    const bsuid = string(contact.bsuid) || null;
    if (!phone && !bsuid) return false;
    await upsertInboxProviderContact({
      phoneId: account.phone_number_id,
      phoneNumber: account.phone_number,
      providerContactId: string(contact.id) || null,
      phone: phone || bsuid || "",
      bsuid,
      name: string(contact.name) || null,
      profileName: string(contact.profile_name) || string(contact.display_name) || null,
      metadata: { username: string(contact.username) || null, sync: true },
    });
    return true;
  });
  return { processed, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

async function syncConversationsPage(account: InboxAccount, cursor?: string | null) {
  const page = await listKirimDevResourcePage(account.phone_number_id, "conversations", cursor);
  const processed = await processConcurrent(page.data, async (raw) => {
    const conversation = record(raw);
    const contact = record(conversation.contact);
    const phone = string(contact.phone_number) || string(contact.wa_id) || string(contact.id);
    const providerConversationId = string(conversation.id);
    if (!providerConversationId || !phone) return false;
    await upsertInboxProviderConversation({
      phoneId: account.phone_number_id,
      phoneNumber: account.phone_number,
      providerConversationId,
      contact: { id: string(contact.id) || null, phone, name: string(contact.name) || null, bsuid: string(contact.bsuid) || null },
      status: string(conversation.status) || null,
      unreadCount: typeof conversation.unread_count === "number" ? conversation.unread_count : null,
      lastMessageAt: string(conversation.last_message_at) || null,
      lastInboundAt: string(conversation.last_inbound_at) || null,
    });
    return true;
  });
  return { processed, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

export async function syncInboxProviderPage(input: { account: InboxAccount; resource: "messages" | "contacts" | "conversations"; restart?: boolean }) {
  const existing = await getInboxSyncState(input.account.id, input.resource);
  if (!input.restart && existing?.last_success_at && !existing.cursor) {
    return { processed: 0, hasMore: false, completed: true, message: `${input.resource} sudah tersinkron penuh. Gunakan mulai ulang bila perlu.` };
  }
  const cursor = input.restart ? null : existing?.cursor ?? null;
  try {
    const result = input.resource === "messages"
      ? await syncMessagesPage(input.account, cursor)
      : input.resource === "contacts"
        ? await syncContactsPage(input.account, cursor)
        : await syncConversationsPage(input.account, cursor);
    await saveInboxSyncState(input.account.id, input.resource, {
      cursor: result.hasMore ? result.nextCursor : null,
      lastSuccessAt: result.hasMore ? null : new Date().toISOString(),
      lastError: null,
    });
    return { ...result, completed: !result.hasMore, message: result.hasMore ? `${result.processed} ${input.resource} tersinkron. Jalankan lagi untuk batch berikutnya.` : `${result.processed} ${input.resource} tersinkron; semua batch selesai.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync KirimDev gagal";
    await saveInboxSyncState(input.account.id, input.resource, { cursor, lastError: message });
    throw new Error(message);
  }
}
