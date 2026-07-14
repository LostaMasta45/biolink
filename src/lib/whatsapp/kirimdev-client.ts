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
    console.log(`[KirimDev] ✅ Pesan terkirim via ${phoneId} ke ${to}`);
    return { success: true };
  } catch (error) {
    console.error('[KirimDev] Network error:', error);
    return { success: false, error: (error as Error).message };
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
 * Kirim pesan ke nomor sendiri (Self-Trigger Reply)
 * Mengirim balasan ke chat yang sama (nomor pengirim = nomor tujuan)
 * 
 * @param phoneId - Phone ID akun yang digunakan
 * @param message - Teks pesan balasan
 */
export async function sendToSelf(
  phoneId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const account = getAccounts().find(a => a.phoneId === phoneId);
  if (!account) {
    return { success: false, error: `Akun dengan phoneId ${phoneId} tidak ditemukan` };
  }
  return sendTextMessage(phoneId, account.phoneNumber, message);
}

/**
 * Kirim pesan ke admin/owner via nomor pertama (default)
 */
export async function sendNotifToAdmin(
  message: string,
  viaPhoneId?: string
): Promise<{ success: boolean; error?: string }> {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    return { success: false, error: 'Tidak ada akun WhatsApp yang dikonfigurasi' };
  }

  // Gunakan akun pertama sebagai default
  const senderAccount = viaPhoneId
    ? accounts.find(a => a.phoneId === viaPhoneId) || accounts[0]
    : accounts[0];

  // Kirim ke nomor sendiri
  return sendTextMessage(senderAccount.phoneId, senderAccount.phoneNumber, message);
}

/**
 * Cek apakah nomor pengirim adalah salah satu nomor bisnis kita
 */
export function isSelfMessage(senderPhone: string): boolean {
  const normalized = normalizePhone(senderPhone);
  return getAccounts().some(acc => normalizePhone(acc.phoneNumber) === normalized);
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
 * Test koneksi ke KirimDev API
 */
export async function testConnection(phoneId: string): Promise<{
  connected: boolean;
  accountLabel: string;
  error?: string;
}> {
  const account = getAccounts().find(a => a.phoneId === phoneId);
  if (!account) {
    return { connected: false, accountLabel: 'Unknown', error: 'Akun tidak ditemukan' };
  }

  const apiKey = process.env.KIRIMDEV_API_KEY;
  if (!apiKey) {
    return { connected: false, accountLabel: account.label, error: 'API Key belum dikonfigurasi' };
  }

  try {
    // Coba fetch info akun (atau endpoint health check KirimDev)
    const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/health`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    return {
      connected: res.ok,
      accountLabel: account.label,
      error: res.ok ? undefined : `HTTP ${res.status}: ${await res.text()}`,
    };
  } catch (error) {
    return {
      connected: false,
      accountLabel: account.label,
      error: (error as Error).message,
    };
  }
}
