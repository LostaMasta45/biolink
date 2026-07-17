import { createClient } from '@supabase/supabase-js';
import type { WhatsAppAccount } from './types';
import { auditApiSend } from '@/services/whatsapp-audit-service';

// ============================================
// KirimDev API Client
// Multi-Account Support (2 nomor WA)
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let cachedSettings: Record<string, unknown> | null = null;
let lastFetchTime = 0;

async function fetchSettingsFromDB() {
  const now = Date.now();
  if (cachedSettings && (now - lastFetchTime < 60000)) {
    return cachedSettings; // Cache 1 minute
  }
  
  try {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      cachedSettings = data;
      lastFetchTime = now;
      return data;
    }
  } catch (err) {
    console.error('[KirimDevClient] Gagal fetch settings dari DB:', err);
  }
  return null;
}

/**
 * Daftar akun WhatsApp yang terhubung (Dynamic).
 * Prioritas: Database Settings > .env
 */
export async function getDynamicAccounts(): Promise<WhatsAppAccount[]> {
  const accounts: WhatsAppAccount[] = [];
  const dbSettings = await fetchSettingsFromDB();

  // Akun 1: Admin Utama (Lostamasta)
  const phoneId1 = dbSettings?.admin_phone_id || process.env.KIRIMDEV_PHONE_ID_1 || process.env.KIRIMDEV_PHONE_ID;
  const phoneNumber1 = dbSettings?.admin_phone_number || process.env.KIRIMDEV_PHONE_NUMBER_1 || process.env.KIRIMDEV_PHONE_NUMBER || '';
  if (phoneId1) {
    accounts.push({
      phoneId: phoneId1,
      label: 'Admin Utama',
      phoneNumber: phoneNumber1,
    });
  }

  // Akun 2: Bot (InfoLokerJombang)
  const phoneId2 = dbSettings?.bot_phone_id || process.env.KIRIMDEV_PHONE_ID_2;
  const phoneNumber2 = dbSettings?.bot_phone_number || process.env.KIRIMDEV_PHONE_NUMBER_2 || '';
  if (phoneId2) {
    accounts.push({
      phoneId: phoneId2,
      label: 'Bot (InfoLokerJombang)',
      phoneNumber: phoneNumber2,
    });
  }

  return accounts;
}

/**
 * Dapatkan API Key secara dinamis (DB > .env)
 */
async function getDynamicApiKey(): Promise<string> {
  const dbSettings = await fetchSettingsFromDB();
  return dbSettings?.api_key || process.env.KIRIMDEV_API_KEY || '';
}

export async function listKirimDevResourcePage(phoneId: string, resource: "messages" | "contacts", cursor?: string | null, limit = 50) {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) throw new Error("KIRIMDEV_API_KEY belum dikonfigurasi");
  const params = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`https://api.kirimdev.com/v1/${phoneId}/${resource}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const raw = await response.text();
  let payload: unknown = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { /* handled below */ }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? JSON.stringify((payload as Record<string, unknown>).error)
      : raw.slice(0, 500) || `HTTP ${response.status}`;
    throw new Error(`KirimDev ${resource} gagal: ${message}`);
  }
  const object = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  return {
    data: Array.isArray(object.data) ? object.data : [],
    hasMore: object.has_more === true,
    nextCursor: typeof object.next_cursor === "string" ? object.next_cursor : null,
  };
}

/**
 * Normalisasi nomor telepon ke format 62xxx (tanpa + dan 0)
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

export interface KirimDevSendContext {
  source?: string;
  correlationId?: string;
  ruleId?: string;
  templateId?: string;
}

export interface KirimDevSendResult {
  success: boolean;
  error?: string;
  messageId?: string;
  providerStatus?: string;
  httpStatus?: number;
  latencyMs?: number;
}

async function requestKirimDevMessage(
  phoneId: string,
  to: string,
  messageType: string,
  payload: Record<string, unknown>,
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
  const startedAt = Date.now();
  const apiKey = await getDynamicApiKey();
  const customer = normalizePhone(to);
  if (!apiKey) {
    const error = 'KIRIMDEV_API_KEY belum dikonfigurasi';
    await auditApiSend({ customer, senderPhoneId: phoneId, messageType, success: false, latencyMs: 0, error, ...context });
    return { success: false, error, latencyMs: 0 };
  }

  try {
    const response = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: customer, ...payload }),
    });
    const latencyMs = Date.now() - startedAt;
    const raw = await response.text();
    let providerResponse: unknown = raw.slice(0, 2000);
    try { providerResponse = raw ? JSON.parse(raw) : {}; } catch { /* response non-JSON */ }
    const responseObject = providerResponse && typeof providerResponse === 'object'
      ? providerResponse as Record<string, unknown>
      : {};
    const responseData = responseObject.data && typeof responseObject.data === 'object'
      ? responseObject.data as Record<string, unknown>
      : {};
    const messages = Array.isArray(responseObject.messages) ? responseObject.messages : [];
    const firstMessage = messages[0] && typeof messages[0] === 'object'
      ? messages[0] as Record<string, unknown>
      : {};
    const messageId = typeof firstMessage.id === 'string'
      ? firstMessage.id
      : typeof responseObject.message_id === 'string' ? responseObject.message_id
      : typeof responseData.id === 'string' ? responseData.id : undefined;
    const providerStatus = typeof firstMessage.message_status === 'string'
      ? firstMessage.message_status
      : typeof responseObject.status === 'string' ? responseObject.status
      : typeof responseData.status === 'string' ? responseData.status : undefined;
    const error = response.ok ? undefined : raw.slice(0, 1000) || `HTTP ${response.status}`;

    await auditApiSend({
      customer,
      senderPhoneId: phoneId,
      messageType,
      success: response.ok,
      httpStatus: response.status,
      latencyMs,
      providerMessageId: messageId,
      providerStatus,
      error,
      response: providerResponse,
      ...context,
    });

    return { success: response.ok, error, messageId, providerStatus, httpStatus: response.status, latencyMs };
  } catch (caught) {
    const latencyMs = Date.now() - startedAt;
    const error = caught instanceof Error ? caught.message : 'Koneksi KirimDev gagal';
    await auditApiSend({ customer, senderPhoneId: phoneId, messageType, success: false, latencyMs, error, ...context });
    return { success: false, error, latencyMs };
  }
}

// ============================================
// Core API Functions
// ============================================

/**
 * Kirim pesan teks via KirimDev API
 * 
 * @param phoneId - Phone ID akun pengirim (dari KirimDev)
 * @param to - Nomor tujuan (format: 6281xxx)
 * @param message - Teks pesan yang akan dikirim
 */
export async function sendTextMessage(
  phoneId: string,
  to: string,
  message: string,
  context: KirimDevSendContext = {},
  previewUrl = false,
): Promise<KirimDevSendResult> {
  return requestKirimDevMessage(phoneId, to, 'text', { type: 'text', text: { body: message, preview_url: previewUrl } }, context);
}

/**
 * Kirim pesan interaktif (Tombol) via KirimDev API
 * 
 * @param phoneId - Phone ID akun pengirim
 * @param to - Nomor tujuan
 * @param body - Teks pesan
 * @param buttons - Array berisi { id: string, title: string } (maksimal 3 tombol)
 * @param header - Opsional objek header (teks/media)
 * @param footer - Opsional teks footer
 */
export async function sendButtonMessage(
  phoneId: string,
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; link?: string },
  footer?: string,
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
    const interactivePayload: Record<string, unknown> = {
      type: 'reply_buttons',
      body: { text: body },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title }
        }))
      }
    };

    if (footer) {
      interactivePayload.footer = { text: footer };
    }

    if (header) {
      if (header.type === 'text' && header.text) interactivePayload.header = { type: 'text', text: header.text };
      else if (header.type !== 'text' && header.link) interactivePayload.header = { type: header.type, [header.type]: { link: header.link } };
    }

    return requestKirimDevMessage(phoneId, to, 'reply_button', {
      type: 'interactive', interactive: interactivePayload,
    }, context);
}

/**
 * Kirim pesan CTA URL (Interactive) via KirimDev API
 * 
 * @param phoneId - Phone ID akun pengirim
 * @param to - Nomor tujuan
 * @param body - Teks utama
 * @param displayText - Teks pada tombol URL
 * @param url - URL tujuan tombol
 * @param header - Opsional header teks/media
 * @param footer - Opsional teks footer
 */
export async function sendCtaUrlMessage(
  phoneId: string,
  to: string,
  body: string,
  displayText: string,
  url: string,
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; link?: string },
  footer?: string,
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
    const interactivePayload: Record<string, unknown> = {
      type: 'cta_url',
      body: { text: body },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: displayText,
          url: url
        }
      }
    };

    if (footer) {
      interactivePayload.footer = { text: footer };
    }

    if (header) {
      if (header.type === 'text' && header.text) interactivePayload.header = { type: 'text', text: header.text };
      else if (header.type !== 'text' && header.link) interactivePayload.header = { type: header.type, [header.type]: { link: header.link } };
    }

    return requestKirimDevMessage(phoneId, to, 'url_button', {
      type: 'interactive', interactive: interactivePayload,
    }, context);
}

/**
 * Kirim pesan List Menu (Interactive) via KirimDev API
 * 
 * @param phoneId - Phone ID akun pengirim
 * @param to - Nomor tujuan
 * @param body - Teks utama
 * @param buttonText - Teks pada tombol list
 * @param sections - Struktur section WhatsApp Cloud API
 * @param header - Opsional header teks; Meta tidak menerima media pada list
 * @param footer - Opsional teks footer
 */
export async function sendListMessage(
  phoneId: string,
  to: string,
  body: string,
  buttonText: string,
  sections: unknown[],
  header?: { type: 'text'; text: string },
  footer?: string,
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
    const interactivePayload: Record<string, unknown> = {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText || 'Pilihan',
        sections: sections
      }
    };

    if (footer) {
      interactivePayload.footer = { text: footer };
    }

    if (header?.text) interactivePayload.header = { type: 'text', text: header.text };

    return requestKirimDevMessage(phoneId, to, 'list', {
      type: 'interactive', interactive: interactivePayload,
    }, context);
}

/**
 * Kirim pesan Media (Image, Video, Document) via KirimDev API
 */
export async function sendMediaMessage(
  phoneId: string,
  to: string,
  type: 'image' | 'video' | 'audio' | 'document',
  url: string,
  caption?: string,
  context: KirimDevSendContext = {},
  filename?: string,
): Promise<KirimDevSendResult> {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: type,
    };

    payload[type] = {
      link: url,
      ...(caption && type !== 'audio' ? { caption } : {}),
      ...(filename && type === 'document' ? { filename } : {}),
    };

    delete payload.messaging_product;
    delete payload.to;
    return requestKirimDevMessage(phoneId, to, type, payload, context);
}

export interface CarouselCardPayload {
  headerType: 'image' | 'video';
  mediaUrl: string;
  body?: string;
  actionType: 'cta_url' | 'quick_reply';
  buttonId: string;
  buttonLabel: string;
  buttonUrl?: string;
}

export async function sendCarouselMessage(
  phoneId: string,
  to: string,
  body: string,
  cards: CarouselCardPayload[],
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
  return requestKirimDevMessage(phoneId, to, 'carousel', {
    type: 'interactive',
    interactive: {
      type: 'carousel',
      body: { text: body },
      action: {
        cards: cards.map((card, cardIndex) => ({
          card_index: cardIndex,
          type: 'cta_url',
          header: { type: card.headerType, [card.headerType]: { link: card.mediaUrl } },
          ...(card.body ? { body: { text: card.body } } : {}),
          action: card.actionType === 'cta_url'
            ? { name: 'cta_url', parameters: { display_text: card.buttonLabel, url: card.buttonUrl } }
            : { buttons: [{ type: 'quick_reply', quick_reply: { id: card.buttonId, title: card.buttonLabel } }] },
        })),
      },
    },
  }, context);
}

export async function markMessageAsRead(
  phoneId: string,
  messageId: string,
  customer: string,
  showTypingIndicator = false,
): Promise<KirimDevSendResult> {
  const startedAt = Date.now();
  const apiKey = await getDynamicApiKey();
  if (!apiKey) return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  try {
    const response = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
        ...(showTypingIndicator ? { typing_indicator: { type: 'text' } } : {}),
      }),
    });
    const latencyMs = Date.now() - startedAt;
    const raw = await response.text();
    const error = response.ok ? undefined : raw.slice(0, 1000) || `HTTP ${response.status}`;
    await auditApiSend({
      customer,
      senderPhoneId: phoneId,
      messageType: 'read_receipt',
      success: response.ok,
      httpStatus: response.status,
      latencyMs,
      error,
      source: 'webhook_auto_mark_read',
      correlationId: messageId,
      response: raw.slice(0, 2000),
    });
    return { success: response.ok, error, httpStatus: response.status, latencyMs };
  } catch (caught) {
    const latencyMs = Date.now() - startedAt;
    const error = caught instanceof Error ? caught.message : 'Mark as read gagal';
    await auditApiSend({ customer, senderPhoneId: phoneId, messageType: 'read_receipt', success: false, latencyMs, error, source: 'webhook_auto_mark_read', correlationId: messageId });
    return { success: false, error, latencyMs };
  }
}

/**
 * Kirim pesan template via KirimDev API
 */
export async function sendTemplateMessage(
  phoneId: string,
  to: string,
  templateName: string,
  languageCode: string,
  components: unknown[],
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
  return requestKirimDevMessage(phoneId, to, 'template', {
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  }, context);
}

// ============================================
// Multi-Account Helper Functions
// ============================================

/**
 * Kirim pesan test ke Admin Utama (Account 1) menggunakan Account 2
 */
export async function sendTestToAdmin(
  phoneId: string,
  message: string
): Promise<KirimDevSendResult> {
  const accounts = await getDynamicAccounts();
  if (accounts.length < 2) {
    return { success: false, error: `Butuh 2 akun WA (Akun Pengirim & Akun Admin) untuk menghindari error batasan Meta API` };
  }

  const adminAccount = accounts[0]; // Admin 1
  const botAccount = accounts[1]; // Admin 2 (Pengirim)

  // Selalu gunakan botAccount sebagai pengirim agar tidak kena error #100
  return sendTextMessage(botAccount.phoneId, adminAccount.phoneNumber, message, {
    source: 'overview_test_bot_to_admin',
  });
}

/**
 * Kirim laporan/notifikasi ke Admin Utama (Account 1) menggunakan Account 2
 */
export async function sendNotifToAdmin(
  message: string
): Promise<KirimDevSendResult> {
  const accounts = await getDynamicAccounts();
  if (accounts.length < 2) {
    return { success: false, error: 'Dibutuhkan minimal 2 akun untuk mengirim notifikasi' };
  }

  const adminAccount = accounts[0]; // Penerima
  const botAccount = accounts[1]; // Pengirim

  return sendTextMessage(botAccount.phoneId, adminAccount.phoneNumber, message, {
    source: 'system_notification_bot_to_admin',
  });
}

/**
 * Ambil daftar nomor admin (Nomor Admin Utama / Account 1)
 */
export async function getAdminNumbers(): Promise<string[]> {
  const accounts = await getDynamicAccounts();
  if (accounts.length > 0) {
    return [normalizePhone(accounts[0].phoneNumber)];
  }
  return [];
}

/**
 * Cek apakah nomor pengirim adalah nomor admin
 */
export async function isAdminNumber(senderPhone: string): Promise<boolean> {
  const normalized = normalizePhone(senderPhone);
  const adminNumbers = await getAdminNumbers();
  return adminNumbers.includes(normalized);
}

/**
 * Dapatkan akun berdasarkan Phone ID
 */
export async function getAccountByPhoneId(phoneId: string): Promise<WhatsAppAccount | undefined> {
  const accounts = await getDynamicAccounts();
  return accounts.find(a => a.phoneId === phoneId);
}

/**
 * Dapatkan akun berdasarkan nomor telepon
 */
export async function getAccountByPhone(phone: string): Promise<WhatsAppAccount | undefined> {
  const normalized = normalizePhone(phone);
  const accounts = await getDynamicAccounts();
  return accounts.find(a => normalizePhone(a.phoneNumber) === normalized);
}

/**
 * Dapatkan semua akun yang terkonfigurasi
 */
export async function getAllAccounts(): Promise<WhatsAppAccount[]> {
  return await getDynamicAccounts();
}

/**
 * Test koneksi ke KirimDev API — dengan log detail
 * 
 * Checks:
 * 1. API Key valid → GET /health
 * 2. Akun terdaftar → GET /accounts 
 * 3. Phone ID cocok → cek di daftar accounts
 */
export async function testConnection(phoneId: string): Promise<{
  connected: boolean;
  accountLabel: string;
  error?: string;
  details: {
    apiKeySet: boolean;
    apiKeyPrefix: string;
    phoneId: string;
    phoneNumber: string;
    healthCheck: { ok: boolean; status?: number; body?: string };
    accountsCheck: { ok: boolean; status?: number; found: boolean; body?: string };
    timestamp: string;
  };
}> {
  const accounts = await getDynamicAccounts();
  const account = accounts.find(a => a.phoneId === phoneId);
  const apiKey = await getDynamicApiKey();
  const baseUrl = 'https://api.kirimdev.com/v1';
  const now = new Date().toISOString();

  const details = {
    apiKeySet: !!apiKey,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 12) + '...' : '(kosong)',
    phoneId: phoneId,
    phoneNumber: account?.phoneNumber || '(tidak ditemukan)',
    healthCheck: { ok: false, status: 0, body: '' } as { ok: boolean; status?: number; body?: string },
    accountsCheck: { ok: false, status: 0, found: false, body: '' } as { ok: boolean; status?: number; found: boolean; body?: string },
    timestamp: now,
  };

  if (!account) {
    return { connected: false, accountLabel: 'Unknown', error: 'Akun tidak ditemukan di env', details };
  }

  if (!apiKey) {
    return { connected: false, accountLabel: account.label, error: 'KIRIMDEV_API_KEY kosong di .env.local', details };
  }

  const headers = { 'Authorization': `Bearer ${apiKey}` };

  // Step 1: Health check (verifikasi API key valid)
  try {
    const healthRes = await fetch(`${baseUrl}/health`, { method: 'GET', headers });
    const healthBody = await healthRes.text();
    details.healthCheck = { ok: healthRes.ok, status: healthRes.status, body: healthBody.substring(0, 200) };

    if (!healthRes.ok) {
      return {
        connected: false,
        accountLabel: account.label,
        error: `API Key tidak valid (health: ${healthRes.status})`,
        details,
      };
    }
  } catch (err) {
    details.healthCheck = { ok: false, body: (err as Error).message };
    return {
      connected: false,
      accountLabel: account.label,
      error: `Gagal koneksi ke KirimDev: ${(err as Error).message}`,
      details,
    };
  }

  // Step 2: Cek accounts (verifikasi phone ID terdaftar)
  try {
    const accountsRes = await fetch(`${baseUrl}/accounts`, { method: 'GET', headers });
    const accountsBody = await accountsRes.text();
    details.accountsCheck = {
      ok: accountsRes.ok,
      status: accountsRes.status,
      found: false,
      body: accountsBody.substring(0, 500),
    };

    if (accountsRes.ok) {
      try {
        const accountsData = JSON.parse(accountsBody);
        const accountsList = accountsData.data || accountsData.accounts || accountsData;
        if (Array.isArray(accountsList)) {
          const found = accountsList.some(
            (value: unknown) => {
              const accountRow = value && typeof value === 'object' ? value as Record<string, unknown> : {};
              return String(accountRow.id) === String(phoneId) || String(accountRow.phone_number_id) === String(phoneId);
            }
          );
          details.accountsCheck.found = found;
          if (!found) {
            return {
              connected: false,
              accountLabel: account.label,
              error: `API Key valid, tapi Phone ID "${phoneId}" tidak ditemukan di akun KirimDev Anda`,
              details,
            };
          }
        }
      } catch {
        // JSON parse gagal, tapi health OK berarti koneksi dasar berhasil
        details.accountsCheck.found = true; // assume OK
      }
    }
  } catch (err) {
    details.accountsCheck = { ok: false, found: false, body: (err as Error).message };
    // Health OK tapi accounts gagal — koneksi dasar OK
  }

  return {
    connected: true,
    accountLabel: account.label,
    details,
  };
}
