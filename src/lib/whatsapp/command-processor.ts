import { sendTextMessage } from './kirimdev-client';

// ============================================
// WhatsApp Command System
// ============================================

export interface Command {
  description: string;
  usage: string;
  enabled: boolean;
  execute: (phoneId: string, senderPhone: string, args: string[]) => Promise<void>;
}

export const COMMANDS: Record<string, Command> = {
  '!help': {
    description: 'Menampilkan daftar perintah yang tersedia',
    usage: '!help',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      const activeCmds = Object.entries(COMMANDS)
        .filter(([_, cmd]) => cmd.enabled)
        .map(([name, cmd]) => `*${name}*\n${cmd.description}`)
        .join('\n\n');
        
      const reply = `🤖 *ILJ-Hub Admin Bot*\n\nBerikut daftar command yang tersedia:\n\n${activeCmds}`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },
  
  '!rekap': {
    description: 'Menampilkan ringkasan pendapatan hari ini',
    usage: '!rekap',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      // TODO: Connect ke database Supabase
      const reply = `📊 *Rekap Hari Ini*\n\nTotal Transaksi: 0\nPendapatan: Rp 0\nStatus: _Belum ada data dari database_`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!cek': {
    description: 'Mengecek status invoice berdasarkan ID',
    usage: '!cek [ID_INVOICE]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length === 0) {
        await sendTextMessage(phoneId, senderPhone, '❌ Mohon sertakan ID invoice.\n\nContoh: *!cek INV-12345*');
        return;
      }
      
      const invoiceId = args[0];
      // TODO: Query ke database
      const reply = `🔍 *Status Invoice*\n\nID: ${invoiceId}\nStatus: _Belum terhubung ke DB_`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!tagihan': {
    description: 'Menampilkan daftar invoice yang belum dibayar (pending)',
    usage: '!tagihan',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      const reply = `⚠️ *Invoice Pending*\n\nSaat ini belum ada data yang bisa ditarik dari database.`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!stats': {
    description: 'Menampilkan statistik klik QRIS dan konversi bulan ini',
    usage: '!stats',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      const reply = `📈 *Statistik Bulan Ini*\n\nPengunjung Web: 0\nKlik QRIS: 0\nKonversi: 0%`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!klien': {
    description: 'Mencari data klien (nama/nomor)',
    usage: '!klien [NAMA]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length === 0) {
        await sendTextMessage(phoneId, senderPhone, '❌ Mohon sertakan nama klien.\n\nContoh: *!klien Budi*');
        return;
      }
      
      const nama = args.join(' ');
      const reply = `👤 *Hasil Pencarian Klien*\n\nQuery: "${nama}"\nHasil: _Belum terhubung ke DB_`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  }
};

/**
 * Memproses pesan teks dan menjalankan command jika valid
 * @param phoneId - Phone ID yang menerima pesan
 * @param senderPhone - Nomor pengirim pesan
 * @param text - Teks pesan
 */
export async function processCommand(phoneId: string, senderPhone: string, text: string): Promise<boolean> {
  if (!text.startsWith('!')) return false;

  const args = text.split(' ');
  const commandName = args[0].toLowerCase();
  const commandArgs = args.slice(1);

  const command = COMMANDS[commandName];
  
  if (!command) {
    await sendTextMessage(
      phoneId,
      senderPhone,
      `❌ Command *${commandName}* tidak ditemukan.\n\nKetik *!help* untuk melihat daftar command.`
    );
    return true;
  }

  if (!command.enabled) {
    await sendTextMessage(
      phoneId,
      senderPhone,
      `⚠️ Command *${commandName}* sedang dinonaktifkan oleh admin.`
    );
    return true;
  }

  try {
    // Kirim indikator "sedang memproses..."
    await sendTextMessage(phoneId, senderPhone, `⏳ Memproses *${commandName}*...`);

    // Execute command
    await command.execute(phoneId, senderPhone, commandArgs);
    console.log(`[Command] ✅ ${commandName} executed successfully for ${senderPhone}`);
    return true;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Command] ❌ Error executing ${commandName}:`, errorMsg);

    await sendTextMessage(
      phoneId,
      senderPhone,
      `❌ *Error saat menjalankan ${commandName}:*\n\n\`${errorMsg}\`\n\nSilakan coba lagi atau hubungi developer.`
    );
    return false;
  }
}
