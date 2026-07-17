import { listKirimDevResourcePage } from "@/lib/whatsapp/kirimdev-client";
import {
  getInboxSyncState,
  persistInboxInbound,
  persistInboxOutbound,
  saveInboxSyncState,
  type InboxAccount,
  upsertInboxProviderContact,
} from "@/services/whatsapp-inbox-store";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function messageBody(message: Record<string, unknown>) {
  if (typeof message.body === "string") return message.body;
  const content = record(message.content);
  if (typeof content.body === "string") return content.body;
  if (typeof content.text === "string") return content.text;
  return "";
}

async function syncMessagesPage(account: InboxAccount, cursor?: string | null) {
  const page = await listKirimDevResourcePage(account.phone_number_id, "messages", cursor);
  let processed = 0;
  for (const raw of page.data) {
    const message = record(raw);
    const direction = string(message.direction).toLowerCase();
    const providerMessageId = string(message.provider_id) || string(message.wamid) || string(message.id);
    const type = string(message.type) || "text";
    const createdAt = string(message.created_at) || string(message.timestamp) || undefined;
    const source = string(message.source) || "provider";
    if (!providerMessageId) continue;
    if (direction === "inbound") {
      const customer = string(message.from) || string(message.contact_phone_number);
      if (!customer) continue;
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
      processed += 1;
    } else if (direction === "outbound") {
      const customer = string(message.to) || string(message.recipient);
      if (!customer) continue;
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
      processed += 1;
    }
  }
  return { processed, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

async function syncContactsPage(account: InboxAccount, cursor?: string | null) {
  const page = await listKirimDevResourcePage(account.phone_number_id, "contacts", cursor);
  let processed = 0;
  for (const raw of page.data) {
    const contact = record(raw);
    const phone = string(contact.phone_number) || string(contact.phone) || string(contact.wa_id);
    const bsuid = string(contact.bsuid) || null;
    if (!phone && !bsuid) continue;
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
    processed += 1;
  }
  return { processed, hasMore: page.hasMore, nextCursor: page.nextCursor };
}

export async function syncInboxProviderPage(input: { account: InboxAccount; resource: "messages" | "contacts"; restart?: boolean }) {
  const existing = await getInboxSyncState(input.account.id, input.resource);
  if (!input.restart && existing?.last_success_at && !existing.cursor) {
    return { processed: 0, hasMore: false, completed: true, message: `${input.resource} sudah tersinkron penuh. Gunakan mulai ulang bila perlu.` };
  }
  const cursor = input.restart ? null : existing?.cursor ?? null;
  try {
    const result = input.resource === "messages"
      ? await syncMessagesPage(input.account, cursor)
      : await syncContactsPage(input.account, cursor);
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
