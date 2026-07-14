import { sendToSelf } from './kirimdev-client';
import type { KirimDevWebhookPayload, CommandDefinition, CommandContext, CommandLog } from './types';
import { handleRekap } from './commands/rekap';
import { handleCekOrder } from './commands/cek-order';
import { handleTagihan } from './commands/tagihan';
import { handleStats } from './commands/stats';
import { handleHelp } from './commands/help';
import { handleKlien } from './commands/klien';

// ============================================
// Command Registry
// Semua command yang tersedia didaftarkan di sini
// ============================================

export const COMMANDS: Record<string, Omit<CommandDefinition, 'name' | 'handler'> & {
  handler: CommandDefinition['handler'];
}> = {
  '!rekap': {
    description: 'Rekap penjualan & keuangan',
    usage: '!rekap [hari|minggu|bulan]',
    enabled: true,
    handler: handleRekap,
  },
  '!cek': {
    description: 'Cek status order berdasarkan ID atau nomor WA',
    usage: '!cek ORD-123 atau !cek 08123456789',
    enabled: true,
    handler: handleCekOrder,
  },
  '!tagihan': {
    description: 'Lihat tagihan pending atau detail invoice',
    usage: '!tagihan atau !tagihan INV-001',
    enabled: true,
    handler: handleTagihan,
  },
  '!stats': {
    description: 'Statistik lengkap bulan ini vs bulan lalu',
    usage: '!stats',
    enabled: true,
    handler: handleStats,
  },
  '!klien': {
    description: 'Cari data klien atau lihat top 10 klien',
    usage: '!klien atau !klien Tokopedia',
    enabled: true,
    handler: handleKlien,
  },
  '!help': {
    description: 'Tampilkan semua command yang tersedia',
    usage: '!help',
    enabled: true,
    handler: handleHelp,
  },
};

// ============================================
// Command Processor
// ============================================

/**
 * Proses pesan self-trigger (command dari diri sendiri)
 * 
 * Flow:
 * 1. Parse command name dan arguments dari teks pesan
 * 2. Cari handler yang sesuai di COMMANDS registry
 * 3. Jalankan handler
 * 4. Kirim hasilnya balik ke chat yang sama via KirimDev API
 * 5. Log hasilnya untuk tracking
 */
export async function processCommand(
  payload: KirimDevWebhookPayload,
  phoneId: string,
  accountLabel: string
): Promise<void> {
  const text = payload.data.message?.text?.trim();
  if (!text || !text.startsWith('!')) return;

  // Parse command dan arguments
  const parts = text.split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = COMMANDS[commandName];

  // Command tidak ditemukan
  if (!command) {
    await sendToSelf(
      phoneId,
      `❌ Command *${commandName}* tidak ditemukan.\n\nKetik *!help* untuk melihat daftar command.`
    );
    return;
  }

  // Command dinonaktifkan
  if (!command.enabled) {
    await sendToSelf(
      phoneId,
      `⚠️ Command *${commandName}* sedang dinonaktifkan oleh admin.`
    );
    return;
  }

  const context: CommandContext = {
    senderPhone: payload.data.from,
    receiverPhoneId: phoneId,
    receiverLabel: accountLabel,
    rawPayload: payload,
  };

  try {
    // Kirim indikator "sedang memproses..."
    await sendToSelf(phoneId, `⏳ Memproses *${commandName}*...`);

    // Execute command handler
    const result = await command.handler(args, context);

    // Kirim hasil
    await sendToSelf(phoneId, result);

    // Log sukses
    console.log(`[Command] ✅ ${commandName} executed successfully via ${accountLabel}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Command] ❌ Error executing ${commandName}:`, errorMsg);

    await sendToSelf(
      phoneId,
      `❌ *Error saat menjalankan ${commandName}:*\n\n\`${errorMsg}\`\n\nSilakan coba lagi atau hubungi developer.`
    );
  }
}
