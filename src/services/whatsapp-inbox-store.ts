import { createClient } from "@supabase/supabase-js";
import type { WhatsAppAccount } from "@/lib/whatsapp/types";

const inboxDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export type InboxConversationStatus = "open" | "pending" | "resolved";
export type InboxPriority = "low" | "normal" | "high" | "urgent";
export type InboxMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type InboxMessageSource = "manual_inbox" | "quick_reply" | "auto_reply" | "notification" | "flow" | "provider" | "app";

interface InboxAccountRow { id: string; phone_number_id: string; is_customer_inbox: boolean; label: string; role: "admin" | "bot"; }
interface InboxContactRow { id: string; wa_account_id: string; phone_number: string; recipient_key: string; name: string | null; profile_name: string | null; }
interface InboxConversationRow {
  id: string; wa_account_id: string; contact_id: string; status: InboxConversationStatus; priority: InboxPriority;
  unread_count: number; needs_reply: boolean; last_message_at: string | null; last_inbound_at: string | null;
  last_outbound_at: string | null; service_window_expires_at: string | null; last_message_preview: string | null;
}
interface InboxMessageRow {
  id: string; wa_account_id: string; conversation_id: string; contact_id: string; provider_message_id: string | null;
  client_request_id: string | null; direction: "inbound" | "outbound" | "system"; message_type: string; body: string | null;
  media_url: string | null; media_mime_type: string | null; media_filename: string | null;
  status: InboxMessageStatus; source: InboxMessageSource; quick_reply_id: string | null; error_message: string | null;
  provider_created_at: string | null; created_at: string; updated_at: string;
}

export interface InboxConversation extends InboxConversationRow {
  contact: Pick<InboxContactRow, "id" | "phone_number" | "name" | "profile_name"> | null;
}

export type InboxMessage = InboxMessageRow;

export interface InboxQuickReply {
  id: string;
  template_id: string;
  shortcut: string;
  sort_order: number;
  is_active: boolean;
  template: { id: string; name: string; body: string; is_active: boolean } | null;
}

export interface InboxAccount extends InboxAccountRow { phone_number: string | null; }
export interface InboxContact extends InboxContactRow { last_synced_at: string | null; updated_at: string; }

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits.startsWith("62") ? digits : `62${digits}`;
}

function preview(body: string | null | undefined, messageType: string) {
  const clean = body?.replace(/\s+/g, " ").trim();
  if (clean) return clean.slice(0, 180);
  return `[${messageType || "pesan"}]`;
}

function sourceFromSend(source?: string): InboxMessageSource {
  if (source === "manual_inbox") return "manual_inbox";
  if (source === "quick_reply") return "quick_reply";
  if (source?.startsWith("auto_reply")) return "auto_reply";
  if (source?.startsWith("notification")) return "notification";
  if (source?.startsWith("flow")) return "flow";
  return "app";
}

async function ensureAccount(input: { phoneId: string; phoneNumber?: string | null; label?: string; role?: "admin" | "bot"; customerInbox?: boolean }): Promise<InboxAccountRow> {
  const { data: existing, error: lookupError } = await inboxDb
    .from("wa_inbox_accounts")
    .select("id,phone_number_id,is_customer_inbox,label,role")
    .eq("phone_number_id", input.phoneId)
    .maybeSingle();
  if (lookupError) throw new Error(`Akun Inbox tidak dapat dibaca: ${lookupError.message}`);
  if (existing) return existing as unknown as InboxAccountRow;

  const { data, error } = await inboxDb.from("wa_inbox_accounts").insert({
    phone_number_id: input.phoneId,
    phone_number: input.phoneNumber ?? null,
    label: input.label ?? "Admin Utama",
    role: input.role ?? "admin",
    is_customer_inbox: input.customerInbox ?? true,
  }).select("id,phone_number_id,is_customer_inbox,label,role").single();
  if (error) throw new Error(`Akun Inbox tidak dapat dibuat: ${error.message}`);
  return data as unknown as InboxAccountRow;
}

export async function syncInboxAccounts(accounts: WhatsAppAccount[]) {
  const rows = accounts.map((account, index) => ({
    phone_number_id: account.phoneId,
    phone_number: account.phoneNumber || null,
    label: account.label,
    role: index === 0 ? "admin" : "bot",
    is_customer_inbox: true,
  }));
  if (!rows.length) return [] as InboxAccount[];
  // Do not order by `created_at`: early Inbox installations were created before
  // that audit column existed. Account role is the reliable, user-facing order.
  const { data, error } = await inboxDb.from("wa_inbox_accounts").upsert(rows, { onConflict: "phone_number_id" })
    .select("id,phone_number_id,phone_number,label,role,is_customer_inbox");
  if (error) throw new Error(`Akun Inbox tidak dapat disinkronkan: ${error.message}`);
  return ((data ?? []) as unknown as InboxAccount[]).sort((left, right) => {
    const roleOrder = { admin: 0, bot: 1 } as const;
    return roleOrder[left.role] - roleOrder[right.role] || left.label.localeCompare(right.label, "id");
  });
}

export async function listInboxAccounts() {
  const { data, error } = await inboxDb.from("wa_inbox_accounts")
    .select("id,phone_number_id,phone_number,label,role,is_customer_inbox").eq("is_customer_inbox", true);
  if (error) throw new Error(`Akun Inbox tidak dapat dimuat: ${error.message}`);
  return ((data ?? []) as unknown as InboxAccount[]).sort((left, right) => {
    const roleOrder = { admin: 0, bot: 1 } as const;
    return roleOrder[left.role] - roleOrder[right.role] || left.label.localeCompare(right.label, "id");
  });
}

async function ensureContact(accountId: string, phone: string, profileName?: string | null): Promise<InboxContactRow> {
  const normalizedPhone = normalizePhone(phone);
  const { data, error } = await inboxDb.from("wa_inbox_contacts").upsert({
    wa_account_id: accountId,
    recipient_key: normalizedPhone,
    phone_number: normalizedPhone,
    profile_name: profileName ?? null,
  }, { onConflict: "wa_account_id,recipient_key" }).select("id,wa_account_id,phone_number,recipient_key,name,profile_name").single();
  if (error) throw new Error(`Kontak Inbox tidak dapat disimpan: ${error.message}`);
  return data as unknown as InboxContactRow;
}

async function getOrCreateConversation(accountId: string, contactId: string): Promise<InboxConversationRow> {
  const { data: existing, error: lookupError } = await inboxDb.from("wa_inbox_conversations")
    .select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview")
    .eq("wa_account_id", accountId).eq("contact_id", contactId).maybeSingle();
  if (lookupError) throw new Error(`Percakapan Inbox tidak dapat dibaca: ${lookupError.message}`);
  if (existing) return existing as unknown as InboxConversationRow;
  const { data, error } = await inboxDb.from("wa_inbox_conversations").insert({ wa_account_id: accountId, contact_id: contactId })
    .select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview").single();
  if (error) {
    const { data: raced } = await inboxDb.from("wa_inbox_conversations")
      .select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview")
      .eq("wa_account_id", accountId).eq("contact_id", contactId).maybeSingle();
    if (raced) return raced as unknown as InboxConversationRow;
    throw new Error(`Percakapan Inbox tidak dapat dibuat: ${error.message}`);
  }
  return data as unknown as InboxConversationRow;
}

export async function persistInboxInbound(input: {
  phoneId: string;
  phoneNumber?: string | null;
  customer: string;
  providerMessageId: string;
  body: string;
  messageType?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  providerCreatedAt?: string;
  profileName?: string | null;
  payload?: Record<string, unknown>;
}) {
  if (!input.phoneId || !input.customer || !input.providerMessageId) return null;
  const { data: duplicate, error: duplicateError } = await inboxDb.from("wa_inbox_messages")
    .select("id,conversation_id,body,message_type,media_url").eq("provider_message_id", input.providerMessageId).maybeSingle();
  if (duplicateError) throw new Error(`Pesan Inbox tidak dapat diduplikasi: ${duplicateError.message}`);
  if (duplicate) {
    if (input.mediaUrl) {
      const { error } = await inboxDb.from("wa_inbox_messages").update({
        media_url: input.mediaUrl,
        media_mime_type: input.mediaMimeType ?? null,
        media_filename: input.mediaFilename ?? null,
        body: input.body || null,
        message_type: input.messageType ?? "text",
        payload: input.payload ?? {},
      }).eq("id", (duplicate as { id: string }).id);
      if (error) throw new Error(`Media pesan inbound tidak dapat diperbarui: ${error.message}`);
    } else if (input.messageType && input.messageType !== "text") {
      // Ensure message_type is patched even when no media_url is present
      await inboxDb.from("wa_inbox_messages").update({
        message_type: input.messageType,
        body: input.body || (duplicate as { body?: string | null }).body || null,
        payload: input.payload ?? {},
      }).eq("id", (duplicate as { id: string }).id);
    }
    return duplicate as { id: string; conversation_id: string };
  }

  const account = await ensureAccount({ phoneId: input.phoneId, phoneNumber: input.phoneNumber, customerInbox: true });
  if (!account.is_customer_inbox) return null;
  const contact = await ensureContact(account.id, input.customer, input.profileName);
  const conversation = await getOrCreateConversation(account.id, contact.id);
  const rawReceivedAt = input.providerCreatedAt && input.providerCreatedAt.trim() ? input.providerCreatedAt : null;
  const receivedAt = rawReceivedAt && !isNaN(new Date(rawReceivedAt).getTime()) ? rawReceivedAt : new Date().toISOString();
  const { data: message, error } = await inboxDb.from("wa_inbox_messages").insert({
    wa_account_id: account.id,
    conversation_id: conversation.id,
    contact_id: contact.id,
    provider_message_id: input.providerMessageId,
    provider_wamid: input.providerMessageId.startsWith("wamid.") ? input.providerMessageId : null,
    direction: "inbound",
    message_type: input.messageType ?? "text",
    body: input.body || null,
    media_url: input.mediaUrl ?? null,
    media_mime_type: input.mediaMimeType ?? null,
    media_filename: input.mediaFilename ?? null,
    status: "read",
    source: "provider",
    provider_created_at: receivedAt,
    read_at: receivedAt,
    payload: input.payload ?? {},
  }).select("id,conversation_id").single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(`Pesan inbound tidak dapat disimpan: ${error.message}`);

  const windowExpiresAt = new Date(new Date(receivedAt).getTime() + 24 * 60 * 60_000).toISOString();
  try {
    await inboxDb.from("wa_inbox_conversations").update({
      status: "open",
      unread_count: conversation.unread_count + 1,
      needs_reply: true,
      last_message_preview: preview(input.body, input.messageType ?? "text"),
      last_message_at: receivedAt,
      last_inbound_at: receivedAt,
      service_window_expires_at: windowExpiresAt,
    }).eq("id", conversation.id);
  } catch (conversationUpdateError) {
    // Non-fatal: the message itself is already persisted.
    console.warn(`[Inbox] Inbound conversation metadata update skipped for ${conversation.id}:`, conversationUpdateError);
  }
  return message as { id: string; conversation_id: string };
}

export async function listInboxConversations(input: { accountId?: string | null; status?: string | null; filter?: string | null; search?: string | null; cursor?: string | null; limit?: number }) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  let query = inboxDb.from("wa_inbox_conversations").select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview,contact:wa_inbox_contacts(id,phone_number,name,profile_name)")
    .order("last_message_at", { ascending: false, nullsFirst: false }).limit(limit + 1);
  if (input.status && ["open", "pending", "resolved"].includes(input.status)) query = query.eq("status", input.status);
  if (input.accountId) query = query.eq("wa_account_id", input.accountId);
  if (input.filter === "unread") query = query.gt("unread_count", 0);
  if (input.filter === "needs_reply") query = query.eq("needs_reply", true);
  if (input.cursor) query = query.lt("last_message_at", input.cursor);
  const { data, error } = await query;
  if (error) throw new Error(`Daftar percakapan tidak dapat dimuat: ${error.message}`);
  let rows = (data ?? []) as unknown as InboxConversation[];
  if (input.search?.trim()) {
    const needle = input.search.trim().toLowerCase();
    rows = rows.filter((row) => [row.contact?.phone_number, row.contact?.name, row.contact?.profile_name, row.last_message_preview].some((value) => value?.toLowerCase().includes(needle)));
  }
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return { data: visible, nextCursor: hasMore ? visible.at(-1)?.last_message_at ?? null : null };
}

export async function listInboxContacts(input: { accountId?: string | null; search?: string | null; cursor?: string | null; limit?: number }) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  let countQuery = inboxDb.from("wa_inbox_contacts").select("*", { count: "exact", head: true });
  if (input.accountId) countQuery = countQuery.eq("wa_account_id", input.accountId);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(`Jumlah kontak Inbox tidak dapat dimuat: ${countError.message}`);
  let query = inboxDb.from("wa_inbox_contacts")
    .select("id,wa_account_id,phone_number,recipient_key,name,profile_name,last_synced_at,updated_at")
    .order("updated_at", { ascending: false }).limit(limit + 1);
  if (input.accountId) query = query.eq("wa_account_id", input.accountId);
  if (input.cursor) query = query.lt("updated_at", input.cursor);
  const { data, error } = await query;
  if (error) throw new Error(`Kontak Inbox tidak dapat dimuat: ${error.message}`);
  let rows = (data ?? []) as unknown as InboxContact[];
  if (input.search?.trim()) {
    const needle = input.search.trim().toLowerCase();
    rows = rows.filter((row) => [row.phone_number, row.name, row.profile_name].some((value) => value?.toLowerCase().includes(needle)));
  }
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  return { data: visible, nextCursor: hasMore ? visible.at(-1)?.updated_at ?? null : null, total: count ?? visible.length };
}

export async function upsertInboxProviderContact(input: { phoneId: string; phoneNumber?: string | null; providerContactId?: string | null; phone: string; bsuid?: string | null; name?: string | null; profileName?: string | null; metadata?: Record<string, unknown> }) {
  const account = await ensureAccount({ phoneId: input.phoneId, phoneNumber: input.phoneNumber, customerInbox: true });
  const phone = normalizePhone(input.phone);
  const recipientKey = input.bsuid || phone;
  const { data, error } = await inboxDb.from("wa_inbox_contacts").upsert({
    wa_account_id: account.id,
    recipient_key: recipientKey,
    phone_number: phone,
    provider_contact_id: input.providerContactId ?? null,
    bsuid: input.bsuid ?? null,
    name: input.name ?? null,
    profile_name: input.profileName ?? null,
    metadata: input.metadata ?? {},
    last_synced_at: new Date().toISOString(),
  }, { onConflict: "wa_account_id,recipient_key" }).select("id,wa_account_id,phone_number,recipient_key,name,profile_name,last_synced_at,updated_at").single();
  if (error) throw new Error(`Kontak provider tidak dapat disimpan: ${error.message}`);
  return data as unknown as InboxContact;
}

/**
 * Stores the lightweight conversation inventory returned by KirimDev. This is
 * deliberately separate from message backfill so the Inbox list becomes useful
 * immediately, even when an account has a large message history.
 */
export async function upsertInboxProviderConversation(input: {
  phoneId: string;
  phoneNumber?: string | null;
  providerConversationId: string;
  contact: { id?: string | null; phone: string; name?: string | null; bsuid?: string | null };
  status?: string | null;
  unreadCount?: number | null;
  lastMessageAt?: string | null;
  lastInboundAt?: string | null;
}) {
  const account = await ensureAccount({ phoneId: input.phoneId, phoneNumber: input.phoneNumber, customerInbox: true });
  const contact = await upsertInboxProviderContact({
    phoneId: input.phoneId,
    phoneNumber: input.phoneNumber,
    providerContactId: input.contact.id ?? null,
    phone: input.contact.phone,
    bsuid: input.contact.bsuid ?? null,
    name: input.contact.name ?? null,
    profileName: input.contact.name ?? null,
    metadata: { sync: true, source: "conversations" },
  });
  const conversation = await getOrCreateConversation(account.id, contact.id);
  const status: InboxConversationStatus = input.status === "pending" || input.status === "resolved" ? input.status : "open";
  const unreadCount = Math.max(0, Number(input.unreadCount ?? 0) || 0);
  const { data, error } = await inboxDb.from("wa_inbox_conversations").update({
    provider_conversation_id: input.providerConversationId,
    status,
    unread_count: unreadCount,
    needs_reply: unreadCount > 0,
    last_message_at: input.lastMessageAt ?? conversation.last_message_at,
    last_inbound_at: input.lastInboundAt ?? conversation.last_inbound_at,
  }).eq("id", conversation.id).select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview").single();
  if (error) throw new Error(`Percakapan provider tidak dapat disimpan: ${error.message}`);
  return data as unknown as InboxConversationRow;
}

export async function getInboxSyncState(accountId: string, resource: "messages" | "contacts" | "conversations") {
  const { data, error } = await inboxDb.from("wa_inbox_sync_state").select("cursor,last_success_at,last_error")
    .eq("wa_account_id", accountId).eq("resource", resource).maybeSingle();
  if (error) throw new Error(`Checkpoint sync tidak dapat dibaca: ${error.message}`);
  return data as { cursor: string | null; last_success_at: string | null; last_error: string | null } | null;
}

export async function saveInboxSyncState(accountId: string, resource: "messages" | "contacts" | "conversations", patch: { cursor?: string | null; lastSuccessAt?: string | null; lastError?: string | null }) {
  const { error } = await inboxDb.from("wa_inbox_sync_state").upsert({
    wa_account_id: accountId,
    resource,
    cursor: patch.cursor ?? null,
    last_success_at: patch.lastSuccessAt ?? null,
    last_error: patch.lastError ?? null,
  }, { onConflict: "wa_account_id,resource" });
  if (error) throw new Error(`Checkpoint sync tidak dapat disimpan: ${error.message}`);
}

export async function getInboxConversation(id: string) {
  const { data, error } = await inboxDb.from("wa_inbox_conversations")
    .select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview,contact:wa_inbox_contacts(id,phone_number,name,profile_name),account:wa_inbox_accounts(id,phone_number_id,phone_number,label,is_customer_inbox)")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(`Percakapan tidak dapat dimuat: ${error.message}`);
  if (!data) throw new Error("Percakapan tidak ditemukan");
  return data as unknown as InboxConversation & { account: { id: string; phone_number_id: string; phone_number: string | null; label: string; is_customer_inbox: boolean } };
}

export async function listInboxMessages(conversationId: string, before?: string | null, limit = 60) {
  let query = inboxDb.from("wa_inbox_messages").select("id,wa_account_id,conversation_id,contact_id,provider_message_id,client_request_id,direction,message_type,body,media_url,media_mime_type,media_filename,status,source,quick_reply_id,error_message,provider_created_at,created_at,updated_at")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(Math.min(100, limit) + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw new Error(`Riwayat pesan tidak dapat dimuat: ${error.message}`);
  const rows = (data ?? []) as unknown as InboxMessage[];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit).reverse();
  return { data: visible, nextCursor: hasMore ? rows[limit - 1]?.created_at ?? null : null };
}

export async function getInboxMediaAttachment(messageId: string) {
  const { data, error } = await inboxDb.from("wa_inbox_messages")
    .select("id,provider_message_id,provider_wamid,message_type,media_url,media_mime_type,media_filename,account:wa_inbox_accounts(phone_number_id)")
    .eq("id", messageId).maybeSingle();
  if (error) throw new Error(`Lampiran Inbox tidak dapat dimuat: ${error.message}`);
  if (!data) throw new Error("Lampiran Inbox tidak ditemukan");
  const attachment = data as unknown as {
    id: string; provider_message_id: string | null; provider_wamid: string | null; message_type: string;
    media_url: string | null; media_mime_type: string | null; media_filename: string | null;
    account: { phone_number_id: string } | null;
  };
  if (!["image", "video", "audio", "document", "sticker"].includes(attachment.message_type)) {
    throw new Error("Pesan ini tidak memiliki lampiran media");
  }
  if (!attachment.account?.phone_number_id || !(attachment.provider_wamid ?? attachment.provider_message_id)) {
    throw new Error("Identitas media KirimDev tidak lengkap");
  }
  return attachment;
}

export async function updateInboxConversation(id: string, patch: { status?: InboxConversationStatus; priority?: InboxPriority; markRead?: boolean }) {
  const payload: Record<string, unknown> = {};
  if (patch.status) payload.status = patch.status;
  if (patch.priority) payload.priority = patch.priority;
  if (patch.markRead) payload.unread_count = 0;
  const { data, error } = await inboxDb.from("wa_inbox_conversations").update(payload).eq("id", id)
    .select("id,wa_account_id,contact_id,status,priority,unread_count,needs_reply,last_message_at,last_inbound_at,last_outbound_at,service_window_expires_at,last_message_preview").single();
  if (error) throw new Error(`Percakapan tidak dapat diperbarui: ${error.message}`);
  return data as unknown as InboxConversationRow;
}

export async function stageInboxManualMessage(input: { conversationId: string; body: string; clientRequestId: string; userId?: string; quickReplyId?: string | null }) {
  const conversation = await getInboxConversation(input.conversationId);
  if (!conversation.account.is_customer_inbox) throw new Error("Akun ini bukan Inbox customer");
  if (!conversation.service_window_expires_at || new Date(conversation.service_window_expires_at).getTime() <= Date.now()) throw new Error("Jendela layanan 24 jam telah berakhir. Pesan teks tidak boleh dikirim.");
  const { data: existing, error: lookupError } = await inboxDb.from("wa_inbox_messages")
    .select("id,wa_account_id,conversation_id,contact_id,provider_message_id,client_request_id,direction,message_type,body,media_url,media_mime_type,media_filename,status,source,quick_reply_id,error_message,provider_created_at,created_at,updated_at")
    .eq("wa_account_id", conversation.account.id).eq("client_request_id", input.clientRequestId).maybeSingle();
  if (lookupError) throw new Error(`Idempotency pesan tidak dapat diperiksa: ${lookupError.message}`);
  if (existing) return { message: existing as unknown as InboxMessage, conversation, alreadyExists: true };
  const source: InboxMessageSource = input.quickReplyId ? "quick_reply" : "manual_inbox";
  const { data, error } = await inboxDb.from("wa_inbox_messages").insert({
    wa_account_id: conversation.account.id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    client_request_id: input.clientRequestId,
    direction: "outbound",
    message_type: "text",
    body: input.body,
    status: "pending",
    source,
    quick_reply_id: input.quickReplyId ?? null,
    sender_user_id: input.userId ?? null,
  }).select("id,wa_account_id,conversation_id,contact_id,provider_message_id,client_request_id,direction,message_type,body,media_url,media_mime_type,media_filename,status,source,quick_reply_id,error_message,provider_created_at,created_at,updated_at").single();
  if (error) throw new Error(`Pesan manual tidak dapat diantrikan: ${error.message}`);
  return { message: data as unknown as InboxMessage, conversation, alreadyExists: false };
}

export async function completeInboxManualMessage(input: { messageId: string; conversationId: string; providerMessageId?: string; error?: string }) {
  const failed = Boolean(input.error);
  const sentAt = new Date().toISOString();
  const { data, error } = await inboxDb.from("wa_inbox_messages").update(failed ? {
    status: "failed", error_message: input.error, failed_at: sentAt,
  } : {
    status: "sent", provider_message_id: input.providerMessageId ?? null,
    provider_wamid: input.providerMessageId?.startsWith("wamid.") ? input.providerMessageId : null,
    sent_at: sentAt, error_message: null,
  }).eq("id", input.messageId).select("id,wa_account_id,conversation_id,contact_id,provider_message_id,client_request_id,direction,message_type,body,media_url,media_mime_type,media_filename,status,source,quick_reply_id,error_message,provider_created_at,created_at,updated_at").single();
  if (error) throw new Error(`Status pesan manual tidak dapat diperbarui: ${error.message}`);
  if (!failed) {
    const { error: conversationError } = await inboxDb.from("wa_inbox_conversations").update({
      needs_reply: false,
      last_message_preview: preview((data as { body?: string | null }).body, "text"),
      last_message_at: sentAt,
      last_outbound_at: sentAt,
    }).eq("id", input.conversationId);
    if (conversationError) throw new Error(`Percakapan manual tidak dapat diperbarui: ${conversationError.message}`);
  }
  return data as unknown as InboxMessage;
}

export async function recordInboxOutboundAttempt(input: { phoneId: string; customer: string; providerMessageId?: string; success: boolean; source?: string; correlationId?: string; error?: string }) {
  const { data: account, error: accountError } = await inboxDb.from("wa_inbox_accounts")
    .select("id,phone_number_id,is_customer_inbox,label,role").eq("phone_number_id", input.phoneId).maybeSingle();
  if (accountError) throw new Error(`Akun Inbox outbound tidak dapat dibaca: ${accountError.message}`);
  if (!account || !(account as InboxAccountRow).is_customer_inbox) return;
  const accountRow = account as unknown as InboxAccountRow;
  const contact = await ensureContact(accountRow.id, input.customer);
  const conversation = await getOrCreateConversation(accountRow.id, contact.id);
  const source = sourceFromSend(input.source);
  const now = new Date().toISOString();
  let message: InboxMessage | null = null;
  if (input.correlationId) {
    const { data } = await inboxDb.from("wa_inbox_messages").select("id,wa_account_id,conversation_id,contact_id,provider_message_id,client_request_id,direction,message_type,body,media_url,media_mime_type,media_filename,status,source,quick_reply_id,error_message,provider_created_at,created_at,updated_at")
      .eq("wa_account_id", accountRow.id).eq("client_request_id", input.correlationId).maybeSingle();
    message = data as unknown as InboxMessage | null;
  }
  if (message) {
    await completeInboxManualMessage({ messageId: message.id, conversationId: message.conversation_id, providerMessageId: input.providerMessageId, error: input.success ? undefined : input.error ?? "KirimDev menolak pengiriman" });
    return;
  }
  const { error } = await inboxDb.from("wa_inbox_messages").insert({
    wa_account_id: accountRow.id,
    conversation_id: conversation.id,
    contact_id: contact.id,
    provider_message_id: input.providerMessageId ?? null,
    client_request_id: input.correlationId ?? null,
    direction: "outbound",
    message_type: "text",
    body: null,
    status: input.success ? "sent" : "failed",
    source,
    sent_at: input.success ? now : null,
    failed_at: input.success ? null : now,
    error_message: input.success ? null : input.error ?? "KirimDev menolak pengiriman",
  });
  if (error?.code === "23505") return;
  if (error) throw new Error(`Pesan outbound Inbox tidak dapat disimpan: ${error.message}`);
}

export async function persistInboxOutbound(input: {
  phoneId: string;
  phoneNumber?: string | null;
  customer: string;
  providerMessageId: string;
  body?: string | null;
  messageType?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  source?: string;
  providerCreatedAt?: string;
  payload?: Record<string, unknown>;
}) {
  if (!input.phoneId || !input.customer || !input.providerMessageId) return null;
  const { data: existing, error: lookupError } = await inboxDb.from("wa_inbox_messages")
    .select("id,conversation_id,body,media_url,message_type").eq("provider_message_id", input.providerMessageId).maybeSingle();
  if (lookupError) throw new Error(`Pesan outbound Inbox tidak dapat dibaca: ${lookupError.message}`);
  if (existing) {
    const current = existing as { id: string; conversation_id: string; body: string | null; media_url: string | null; message_type: string };
    const shouldPatchBody = !current.body && input.body;
    const shouldPatchMedia = input.mediaUrl && !current.media_url;
    if (shouldPatchBody || shouldPatchMedia) {
      const patch: Record<string, unknown> = { payload: input.payload ?? {} };
      if (shouldPatchBody) { patch.body = input.body; patch.message_type = input.messageType ?? "text"; }
      if (input.mediaUrl) { patch.media_url = input.mediaUrl; patch.media_mime_type = input.mediaMimeType ?? null; patch.media_filename = input.mediaFilename ?? null; }
      if (input.messageType) patch.message_type = input.messageType;
      const { error } = await inboxDb.from("wa_inbox_messages").update(patch).eq("id", current.id);
      if (error) throw new Error(`Isi pesan outbound tidak dapat diperbarui: ${error.message}`);
      // Also update conversation preview when we enrich an existing message
      try {
        await inboxDb.from("wa_inbox_conversations").update({
          last_message_preview: preview(input.body, input.messageType ?? "text"),
        }).eq("id", current.conversation_id);
      } catch { /* non-fatal preview update */ }
    }
    return current;
  }
  const account = await ensureAccount({ phoneId: input.phoneId, phoneNumber: input.phoneNumber, customerInbox: true });
  if (!account.is_customer_inbox) return null;
  const contact = await ensureContact(account.id, input.customer);
  const conversation = await getOrCreateConversation(account.id, contact.id);
  const rawSentAt = input.providerCreatedAt && input.providerCreatedAt.trim() ? input.providerCreatedAt : null;
  const sentAt = rawSentAt && !isNaN(new Date(rawSentAt).getTime()) ? rawSentAt : new Date().toISOString();
  // The synchronous API response can contain an internal `msg_*` id, while
  // message.sent reliably carries the Meta `wamid`. Reconcile the staged Inbox
  // row before inserting so one physical WhatsApp send remains one bubble.
  if (input.providerMessageId.startsWith("wamid.")) {
    const { data: staged, error: stagedError } = await inboxDb.from("wa_inbox_messages")
      .select("id,conversation_id")
      .eq("wa_account_id", account.id).eq("conversation_id", conversation.id)
      .eq("direction", "outbound").not("client_request_id", "is", null).is("provider_wamid", null)
      .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (stagedError) throw new Error(`Pesan Inbox tertunda tidak dapat dibaca: ${stagedError.message}`);
    if (staged) {
      const { error: reconcileError } = await inboxDb.from("wa_inbox_messages").update({
        provider_message_id: input.providerMessageId,
        provider_wamid: input.providerMessageId,
        message_type: input.messageType ?? "text",
        body: input.body ?? null,
        media_url: input.mediaUrl ?? null,
        media_mime_type: input.mediaMimeType ?? null,
        media_filename: input.mediaFilename ?? null,
        status: "sent",
        provider_created_at: sentAt,
        sent_at: sentAt,
        error_message: null,
        payload: input.payload ?? {},
      }).eq("id", (staged as { id: string }).id);
      if (reconcileError) throw new Error(`Pesan Inbox tidak dapat direkonsiliasi: ${reconcileError.message}`);
      return staged as { id: string; conversation_id: string };
    }
  }
  const { data, error } = await inboxDb.from("wa_inbox_messages").insert({
    wa_account_id: account.id,
    conversation_id: conversation.id,
    contact_id: contact.id,
    provider_message_id: input.providerMessageId,
    provider_wamid: input.providerMessageId.startsWith("wamid.") ? input.providerMessageId : null,
    direction: "outbound",
    message_type: input.messageType ?? "text",
    body: input.body ?? null,
    media_url: input.mediaUrl ?? null,
    media_mime_type: input.mediaMimeType ?? null,
    media_filename: input.mediaFilename ?? null,
    status: "sent",
    source: sourceFromSend(input.source),
    provider_created_at: sentAt,
    sent_at: sentAt,
    payload: input.payload ?? {},
  }).select("id,conversation_id").single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(`Pesan outbound tidak dapat disimpan: ${error.message}`);
  try {
    await inboxDb.from("wa_inbox_conversations").update({
      needs_reply: false,
      last_message_preview: preview(input.body, input.messageType ?? "text"),
      last_message_at: sentAt,
      last_outbound_at: sentAt,
    }).eq("id", conversation.id);
  } catch (conversationUpdateError) {
    // Non-fatal: the message itself is already persisted. The conversation
    // metadata (preview, timestamps) will self-heal on the next message.
    console.warn(`[Inbox] Conversation metadata update skipped for ${conversation.id}:`, conversationUpdateError);
  }
  return data as { id: string; conversation_id: string };
}

const statusRank: Record<InboxMessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 2 };

export async function recordInboxProviderStatus(input: { providerMessageId: string; providerStatus: string; error?: unknown }) {
  const { data, error } = await inboxDb.from("wa_inbox_messages")
    .select("id,status,conversation_id").eq("provider_message_id", input.providerMessageId).maybeSingle();
  if (error) throw new Error(`Status Inbox tidak dapat dibaca: ${error.message}`);
  if (!data) return;
  const current = data as { id: string; status: InboxMessageStatus; conversation_id: string };
  const normalized = input.providerStatus.trim().toLowerCase();
  const next: InboxMessageStatus = ["failed", "undelivered", "error"].includes(normalized) ? "failed" : normalized === "read" ? "read" : ["delivered", "played"].includes(normalized) ? "delivered" : "sent";
  if (current.status === "read" || current.status === "failed" || (next !== "failed" && statusRank[next] <= statusRank[current.status])) return;
  const now = new Date().toISOString();
  const errorMessage = typeof input.error === "string" ? input.error : input.error ? JSON.stringify(input.error) : null;
  const update: Record<string, unknown> = { status: next, error_message: next === "failed" ? errorMessage ?? `Provider reported ${normalized}` : null };
  if (next === "sent") update.sent_at = now;
  if (next === "delivered") update.delivered_at = now;
  if (next === "read") update.read_at = now;
  if (next === "failed") update.failed_at = now;
  const { error: updateError } = await inboxDb.from("wa_inbox_messages").update(update).eq("id", current.id);
  if (updateError) throw new Error(`Status Inbox tidak dapat diperbarui: ${updateError.message}`);
}

export async function listInboxQuickReplies() {
  const { data, error } = await inboxDb.from("wa_inbox_quick_replies")
    .select("id,template_id,shortcut,sort_order,is_active,template:templates(id,name,body,is_active)")
    .order("sort_order", { ascending: true }).order("shortcut", { ascending: true });
  if (error) throw new Error(`Balas Cepat tidak dapat dimuat: ${error.message}`);
  return (data ?? []) as unknown as InboxQuickReply[];
}

export async function createInboxQuickReply(input: { templateId: string; shortcut: string; sortOrder?: number; isActive?: boolean }) {
  const shortcut = input.shortcut.trim().replace(/^\/+/, "").toLowerCase();
  const { data, error } = await inboxDb.from("wa_inbox_quick_replies").insert({
    template_id: input.templateId, shortcut, sort_order: input.sortOrder ?? 0, is_active: input.isActive ?? true,
  }).select("id,template_id,shortcut,sort_order,is_active,template:templates(id,name,body,is_active)").single();
  if (error) throw new Error(`Balas Cepat tidak dapat disimpan: ${error.message}`);
  return data as unknown as InboxQuickReply;
}

export async function updateInboxQuickReply(id: string, input: { shortcut: string; sortOrder?: number; isActive?: boolean }) {
  const shortcut = input.shortcut.trim().replace(/^\/+/, "").toLowerCase();
  const payload: Record<string, unknown> = { shortcut };
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  const { data, error } = await inboxDb.from("wa_inbox_quick_replies").update(payload)
    .eq("id", id).select("id,template_id,shortcut,sort_order,is_active,template:templates(id,name,body,is_active)").single();
  if (error) throw new Error(`Balas Cepat tidak dapat diperbarui: ${error.message}`);
  return data as unknown as InboxQuickReply;
}

export async function deleteInboxQuickReply(id: string) {
  const { error } = await inboxDb.from("wa_inbox_quick_replies").delete().eq("id", id);
  if (error) throw new Error(`Balas Cepat tidak dapat dihapus: ${error.message}`);
}
