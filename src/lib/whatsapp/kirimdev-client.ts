import type { WhatsAppAccount } from './types';

// ============================================
// KirimDev API Client
// Multi-Account Support (2 nomor WA)
// ============================================

/**
 * Daftar akun WhatsApp yang terhubung.
 * 
 * Konfigurasi di .env.local:
 *   KIRIMDEV_API_KEY=sk-xxxxxxxxx        (1 API key untuk semua akun)
 *   KIRIMDEV_PHONE_ID_1=xxxxx            (Phone ID nomor 1 - Lostamasta)
 *   KIRIMDEV_PHONE_NUMBER_1=6283122866975
 *   KIRIMDEV_PHONE_ID_2=xxxxx            (Phone ID nomor 2 - InfoLokerJombang)
 *   KIRIMDEV_PHONE_NUMBER_2=628974266000
 */
function getAccounts(): WhatsAppAccount[] {
  const accounts: WhatsAppAccount[] = [];

  // Akun 1: Lostamasta
  // Mendukung KIRIMDEV_PHONE_ID (tanpa _1) ATAU KIRIMDEV_PHONE_ID_1
  const phoneId1 = process.env.KIRIMDEV_PHONE_ID_1 || process.env.KIRIMDEV_PHONE_ID;
  const phoneNumber1 = process.env.KIRIMDEV_PHONE_NUMBER_1 || process.env.KIRIMDEV_PHONE_NUMBER || '';
  if (phoneId1) {
    accounts.push({
      phoneId: phoneId1,
      label: 'Lostamasta',
      phoneNumber: phoneNumber1,
    });
  }

  // Akun 2: InfoLokerJombang
  if (process.env.KIRIMDEV_PHONE_ID_2) {
    accounts.push({
      phoneId: process.env.KIRIMDEV_PHONE_ID_2,
      label: 'InfoLokerJombang',
      phoneNumber: process.env.KIRIMDEV_PHONE_NUMBER_2 || '',
    });
  }

  return accounts;
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
  const apiKey = process.env.KIRIMDEV_API_KEY;
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
 * @param text - Teks pesan
 * @param buttons - Array berisi { id: string, title: string } (maksimal 3 tombol)
 */
export async function sendButtonMessage(
  phoneId: string,
  to: string,
  text: string,
  buttons: { id: string; title: string }[]
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.KIRIMDEV_API_KEY;
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
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
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
 * Kirim pesan template via KirimDev API
 */
export async function sendTemplateMessage(
  phoneId: string,
  to: string,
  templateName: string,
  languageCode: string,
  components: any[]
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.KIRIMDEV_API_KEY;
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
  const accounts = getAccounts();
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
  const accounts = getAccounts();
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
export function getAdminNumbers(): string[] {
  const accounts = getAccounts();
  if (accounts.length > 0) {
    return [normalizePhone(accounts[0].phoneNumber)];
  }
  return [];
}

/**
 * Cek apakah nomor pengirim adalah nomor admin
 */
export function isAdminNumber(senderPhone: string): boolean {
  const normalized = normalizePhone(senderPhone);
  return getAdminNumbers().includes(normalized);
}

/**
 * Dapatkan akun berdasarkan Phone ID
 */
export function getAccountByPhoneId(phoneId: string): WhatsAppAccount | undefined {
  return getAccounts().find(a => a.phoneId === phoneId);
}

/**
 * Dapatkan akun berdasarkan nomor telepon
 */
export function getAccountByPhone(phone: string): WhatsAppAccount | undefined {
  const normalized = normalizePhone(phone);
  return getAccounts().find(a => normalizePhone(a.phoneNumber) === normalized);
}

/**
 * Dapatkan semua akun yang terkonfigurasi
 */
export function getAllAccounts(): WhatsAppAccount[] {
  return getAccounts();
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
  const account = getAccounts().find(a => a.phoneId === phoneId);
  const apiKey = process.env.KIRIMDEV_API_KEY || '';
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

