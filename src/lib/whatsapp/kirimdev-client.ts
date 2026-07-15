import { createClient } from '@supabase/supabase-js';
import type { WhatsAppAccount } from './types';

// ============================================
// KirimDev API Client
// Multi-Account Support (2 nomor WA)
// ============================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let cachedSettings: any = null;
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
  message: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) {
    return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  }

  try {
    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'text',
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[KirimDev] Gagal kirim via ${phoneId}:`, errorText);
      return { success: false, error: errorText };
    }

    const data = await res.json();
    return { success: true };
  } catch (err: any) {
    console.error(`[KirimDev] Exception pada sendTextMessage:`, err);
    return { success: false, error: err.message };
  }
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
  footer?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) {
    return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  }

  try {
    const interactivePayload: any = {
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
      if (header.type === 'text' && header.text) {
        interactivePayload.header = { type: 'text', text: header.text };
      } else if (['image', 'video', 'document'].includes(header.type) && header.link) {
        interactivePayload.header = { type: header.type, [header.type]: { link: header.link } };
      }
    }

    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'interactive',
        interactive: interactivePayload
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[KirimDev] Gagal kirim button via ${phoneId}:`, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[KirimDev] Exception pada sendButtonMessage:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Kirim pesan List Menu (Interactive) via KirimDev API
 * 
 * @param phoneId - Phone ID akun pengirim
 * @param to - Nomor tujuan
 * @param body - Teks utama
 * @param buttonText - Teks pada tombol list
 * @param sections - Struktur section WhatsApp Cloud API
 * @param header - Opsional objek header (teks/media)
 * @param footer - Opsional teks footer
 */
export async function sendListMessage(
  phoneId: string,
  to: string,
  body: string,
  buttonText: string,
  sections: any[],
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; link?: string },
  footer?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) {
    return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  }

  try {
    const interactivePayload: any = {
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

    if (header) {
      if (header.type === 'text' && header.text) {
        interactivePayload.header = { type: 'text', text: header.text };
      } else if (['image', 'video', 'document'].includes(header.type) && header.link) {
        interactivePayload.header = { type: header.type, [header.type]: { link: header.link } };
      }
    }

    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'interactive',
        interactive: interactivePayload
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[KirimDev] Gagal kirim list via ${phoneId}:`, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[KirimDev] Exception pada sendListMessage:`, err);
    return { success: false, error: err.message };
  }
}

/**
 * Kirim pesan Media (Image, Video, Document) via KirimDev API
 */
export async function sendMediaMessage(
  phoneId: string,
  to: string,
  type: 'image' | 'video' | 'document',
  url: string,
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) {
    return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  }

  try {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: normalizePhone(to),
      type: type,
    };

    payload[type] = {
      link: url,
    };
    
    if (caption) {
      payload[type].caption = caption;
    }

    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[KirimDev] Gagal kirim media via ${phoneId}:`, errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[KirimDev] Exception pada sendMediaMessage:`, err);
    return { success: false, error: err.message };
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
  components: any[]
): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getDynamicApiKey();
  if (!apiKey) {
    return { success: false, error: 'KIRIMDEV_API_KEY belum dikonfigurasi' };
  }

  try {
    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
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
): Promise<{ success: boolean; error?: string }> {
  const accounts = await getDynamicAccounts();
  if (accounts.length < 2) {
    return { success: false, error: `Butuh 2 akun WA (Akun Pengirim & Akun Admin) untuk menghindari error batasan Meta API` };
  }

  const adminAccount = accounts[0]; // Admin 1
  const botAccount = accounts[1]; // Admin 2 (Pengirim)

  // Selalu gunakan botAccount sebagai pengirim agar tidak kena error #100
  return sendTextMessage(botAccount.phoneId, adminAccount.phoneNumber, message);
}

/**
 * Kirim laporan/notifikasi ke Admin Utama (Account 1) menggunakan Account 2
 */
export async function sendNotifToAdmin(
  message: string
): Promise<{ success: boolean; error?: string }> {
  const accounts = await getDynamicAccounts();
  if (accounts.length < 2) {
    return { success: false, error: 'Dibutuhkan minimal 2 akun untuk mengirim notifikasi' };
  }

  const adminAccount = accounts[0]; // Penerima
  const botAccount = accounts[1]; // Pengirim

  return sendTextMessage(botAccount.phoneId, adminAccount.phoneNumber, message);
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
            (a: any) => String(a.id) === String(phoneId) || String(a.phone_number_id) === String(phoneId)
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

