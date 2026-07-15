import { sendTextMessage, sendButtonMessage } from './kirimdev-client';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase admin client for server-side logic (bypasses RLS if service key is used, or works if public)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
      // Dapatkan data hari ini dari Supabase payment_orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: payments, error } = await supabase
        .from('payment_orders')
        .select('*')
        .gte('created_at', today.toISOString());

      if (error) {
        await sendTextMessage(phoneId, senderPhone, `❌ Gagal mengambil rekap: ${error.message}`);
        return;
      }

      const totalTransactions = payments?.length || 0;
      const paidTransactions = payments?.filter(p => p.status === 'PAID') || [];
      const totalRevenue = paidTransactions.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      
      const reply = `📊 *Rekap Hari Ini*\n\nTotal Transaksi: ${totalTransactions}\nTransaksi Sukses: ${paidTransactions.length}\n*Pendapatan: Rp ${totalRevenue.toLocaleString('id-ID')}*`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!cek': {
    description: 'Mengecek status invoice atau order berdasarkan ID',
    usage: '!cek [ID_ORDER]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length === 0) {
        await sendTextMessage(phoneId, senderPhone, '❌ Mohon sertakan ID Order/Invoice.\n\nContoh: *!cek INV-12345*');
        return;
      }
      
      const orderId = args[0];
      
      // Cek di tabel payment_orders
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error || !data) {
        await sendTextMessage(phoneId, senderPhone, `❌ Order/Invoice dengan ID *${orderId}* tidak ditemukan.`);
        return;
      }

      const reply = `🔍 *Status Order*\n\nID: ${data.order_id}\nKlien: ${data.customer_name}\nLayanan: ${data.package_name}\nNominal: Rp ${(data.amount || 0).toLocaleString('id-ID')}\nStatus: *${data.status}*\n\n_Dibuat: ${new Date(data.created_at).toLocaleString('id-ID')}_`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!tagihan': {
    description: 'Menampilkan daftar invoice yang belum dibayar (pending)',
    usage: '!tagihan',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        await sendTextMessage(phoneId, senderPhone, `✅ *Kabar Baik!*\n\nSaat ini tidak ada tagihan/invoice yang tertunggak (Pending).`);
        return;
      }

      const totalPending = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const tagihanList = data.map(d => `- ${d.order_id} | ${d.customer_name} | Rp ${(d.amount || 0).toLocaleString('id-ID')}`).join('\n');

      const reply = `⚠️ *Ada ${data.length} Invoice Pending*\n\nTotal Potensi Pendapatan: *Rp ${totalPending.toLocaleString('id-ID')}*\n\n${tagihanList}\n\n_Ketik !tagih [ID_ORDER] untuk mengirimkan pengingat ke klien tersebut._`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!tagih': {
    description: 'Mengirimkan pesan pengingat pembayaran ke klien',
    usage: '!tagih [ID_ORDER]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length === 0) {
        await sendTextMessage(phoneId, senderPhone, '❌ Mohon sertakan ID Order.\n\nContoh: *!tagih INV-12345*');
        return;
      }

      const orderId = args[0];

      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error || !data) {
        await sendTextMessage(phoneId, senderPhone, `❌ Order/Invoice dengan ID *${orderId}* tidak ditemukan.`);
        return;
      }

      if (data.status === 'PAID') {
        await sendTextMessage(phoneId, senderPhone, `⚠️ Klien ${data.customer_name} *SUDAH LUNAS*. Tidak perlu ditagih lagi.`);
        return;
      }

      const wa = data.customer_whatsapp;
      const nominal = data.amount || 0;
      const payUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infolokerjombang.net'}/pay/${orderId}`;

      // Pesan ke klien
      const clientMsg = `Halo Kak ${data.customer_name} 👋\n\nSekadar mengingatkan bahwa tagihan untuk layanan *${data.package_name}* senilai *Rp ${nominal.toLocaleString('id-ID')}* belum dibayarkan.\n\nSilakan selesaikan pembayaran Anda melalui link berikut:\n🔗 ${payUrl}\n\nJika sudah membayar, mohon abaikan pesan ini. Terima kasih! 🙏`;
      await sendTextMessage(phoneId, wa, clientMsg);

      // Konfirmasi ke admin
      await sendTextMessage(phoneId, senderPhone, `🔔 _Pesan pengingat pembayaran telah berhasil dikirim ke ${data.customer_name} (${wa})._`);
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
    description: 'Mencari histori klien berdasarkan nomor WA',
    usage: '!klien [NOMOR_WA]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length === 0) {
        await sendTextMessage(phoneId, senderPhone, '❌ Mohon sertakan Nomor WA klien (628...).\n\nContoh: *!klien 6281234567*');
        return;
      }
      
      const wa = args[0].replace(/[^0-9]/g, '');
      
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .like('customer_whatsapp', `%${wa}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data || data.length === 0) {
        await sendTextMessage(phoneId, senderPhone, `❌ Tidak ada riwayat transaksi untuk nomor WA *${wa}*.`);
        return;
      }

      const totalSpent = data.filter(d => d.status === 'PAID').reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const historyList = data.map(d => `- ${d.order_id} (${d.status})`).join('\n');

      const reply = `👤 *Data Klien: ${data[0].customer_name}*\nWA: ${wa}\n\n*Total Belanja:* Rp ${totalSpent.toLocaleString('id-ID')}\n*Histori Terakhir:*\n${historyList}`;
      await sendTextMessage(phoneId, senderPhone, reply);
    }
  },

  '!invoice': {
    description: 'Membuat tagihan instan untuk dikirim ke nomor klien',
    usage: '!invoice [NOMOR_WA] [NOMINAL] [NAMA_LAYANAN]',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      if (args.length < 3) {
        await sendTextMessage(phoneId, senderPhone, '❌ Format salah. Gunakan: *!invoice [NOMOR_WA] [NOMINAL] [NAMA_LAYANAN]*\nContoh: *!invoice 628123 150000 Premium*');
        return;
      }

      const wa = args[0].replace(/[^0-9]/g, '');
      const nominal = parseInt(args[1].replace(/[^0-9]/g, ''));
      const layanan = args.slice(2).join(' ');
      const orderId = `INV-${Date.now().toString().slice(-6)}`;

      // Insert ke payment_orders
      const { error } = await supabase.from('payment_orders').insert({
        order_id: orderId,
        customer_name: 'Klien Instan',
        customer_whatsapp: wa,
        customer_company: '-',
        package_id: 999,
        package_name: layanan,
        amount: nominal,
        total_amount: nominal,
        status: 'PENDING'
      });

      if (error) {
        await sendTextMessage(phoneId, senderPhone, `❌ Gagal membuat invoice: ${error.message}`);
        return;
      }

      // Link pembayaran (asumsi menggunakan direct_url atau URL aplikasi)
      const payUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infolokerjombang.net'}/pay/${orderId}`;
      
      const adminReply = `✅ *Invoice Berhasil Dibuat!*\nID: ${orderId}\nNominal: Rp ${nominal.toLocaleString('id-ID')}\nLink: ${payUrl}\n\n_Sedang mengirim link ke ${wa}..._`;
      await sendTextMessage(phoneId, senderPhone, adminReply);

      // Kirim pesan tagihan ke Klien dari Bot
      const clientMsg = `Halo! 👋\n\nBerikut adalah link tagihan Anda untuk layanan *${layanan}* senilai *Rp ${nominal.toLocaleString('id-ID')}*.\n\nKlik link berikut untuk melakukan pembayaran (Mendukung QRIS, e-Wallet, dll):\n🔗 ${payUrl}\n\nTerima kasih! 🙏`;
      await sendTextMessage(phoneId, wa, clientMsg);
    }
  },
  '!template': {
    description: 'Manajemen template pesan WA (!template list | !template kirim [KODE] [WA])',
    usage: '!template',
    enabled: true,
    execute: async (phoneId, senderPhone, args) => {
      const action = args[0]?.toLowerCase();

      if (action === 'list') {
        const { data, error } = await supabase.from('whatsapp_templates').select('code, name');
        if (error || !data) {
          await sendTextMessage(phoneId, senderPhone, `❌ Gagal memuat template: ${error?.message || 'DB Error'}`);
          return;
        }
        const list = data.map(d => `- *${d.code}* (${d.name})`).join('\n');
        await sendTextMessage(phoneId, senderPhone, `📋 *Daftar Template:*\n\n${list}\n\n_Kirim template dengan: !template kirim [KODE] [NOMOR_WA]_`);
        return;
      }

      if (action === 'kirim') {
        const code = args[1]?.toUpperCase();
        const wa = args[2]?.replace(/[^0-9]/g, '');

        if (!code || !wa) {
          await sendTextMessage(phoneId, senderPhone, '❌ Format salah. Gunakan: *!template kirim [KODE] [NOMOR_WA]*');
          return;
        }

        const { data, error } = await supabase.from('whatsapp_templates').select('content').eq('code', code).single();
        if (error || !data) {
          await sendTextMessage(phoneId, senderPhone, `❌ Template dengan kode *${code}* tidak ditemukan.`);
          return;
        }

        await sendTextMessage(phoneId, wa, data.content);
        await sendTextMessage(phoneId, senderPhone, `✅ Template *${code}* berhasil dikirim ke ${wa}.`);
        return;
      }

      await sendTextMessage(phoneId, senderPhone, '❌ Aksi tidak valid. Gunakan: *!template list* atau *!template kirim*');
    }
  },
  '!buat_invoice': {
    description: 'Memulai form interaktif pembuatan invoice',
    usage: '!buat_invoice',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      // Hapus semua sesi lama untuk sender ini (agar tidak ada duplikat karena phoneId berbeda)
      await supabase.from('bot_sessions').delete().eq('sender_phone', senderPhone);
      // Insert sesi baru
      await supabase.from('bot_sessions').insert({
        phone_id: phoneId,
        sender_phone: senderPhone,
        state: 'AWAIT_INV_TYPE',
        data: {}
      });
      console.log(`[BotSession] ✅ Created session for ${senderPhone} | state=AWAIT_INV_TYPE | phoneId=${phoneId}`);

      await sendButtonMessage(
        phoneId, 
        senderPhone, 
        '📋 *Pilih Jenis Invoice:*\n\nSilakan klik salah satu tombol di bawah ini:', 
        [
          { id: '!inv_lowongan', title: 'Invoice Lowongan' },
          { id: '!inv_umum', title: 'Invoice Lengkap' }
        ]
      );
    }
  },
  '!inv_lowongan': {
    description: 'Internal Handler untuk tombol Invoice Lowongan',
    usage: '!inv_lowongan',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      // Hapus semua sesi lama, lalu insert baru (menghindari duplikat karena phoneId berbeda)
      await supabase.from('bot_sessions').delete().eq('sender_phone', senderPhone);
      await supabase.from('bot_sessions').insert({
        phone_id: phoneId,
        sender_phone: senderPhone,
        state: 'LOWONGAN_AWAIT_NAME',
        data: { type: 'lowongan' }
      });
      console.log(`[BotSession] ✅ Created session for ${senderPhone} | state=LOWONGAN_AWAIT_NAME | phoneId=${phoneId}`);
      await sendTextMessage(phoneId, senderPhone, '🏢 Masukkan *Nama Perusahaan/Klien*:');
    }
  },
  '!inv_umum': {
    description: 'Internal Handler untuk tombol Invoice Umum',
    usage: '!inv_umum',
    enabled: true,
    execute: async (phoneId, senderPhone) => {
      // Hapus semua sesi lama, lalu insert baru (menghindari duplikat karena phoneId berbeda)
      await supabase.from('bot_sessions').delete().eq('sender_phone', senderPhone);
      await supabase.from('bot_sessions').insert({
        phone_id: phoneId,
        sender_phone: senderPhone,
        state: 'UMUM_AWAIT_NAME',
        data: { type: 'umum' }
      });
      console.log(`[BotSession] ✅ Created session for ${senderPhone} | state=UMUM_AWAIT_NAME | phoneId=${phoneId}`);
      await sendTextMessage(phoneId, senderPhone, '🏢 Masukkan *Nama PT / Klien*:');
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
  // 1. Cek apakah ada sesi aktif di bot_sessions
  // Kita abaikan phoneId dari parameter saat mencari sesi, karena KirimDev terkadang tidak konsisten
  // mengirimkan phoneId untuk teks vs button.
  const { data: sessions, error: sessionError } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('sender_phone', senderPhone)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (sessionError) {
    console.error(`[BotSession] ❌ Error fetching session for ${senderPhone}:`, sessionError.message);
  }

  const session = sessions && sessions.length > 0 ? sessions[0] : null;
  if (session) {
    console.log(`[BotSession] 📋 Found session for ${senderPhone} | state=${session.state} | phone_id=${session.phone_id}`);
  }

  if (session && session.state !== 'IDLE' && !text.startsWith('!')) {
    // Kita berada dalam percakapan interaktif
    // Gunakan phone_id yang tersimpan di sesi agar balasan konsisten dari bot yang sama
    const activePhoneId = session.phone_id || phoneId;
    return await handleConversationState(activePhoneId, senderPhone, text, session);
  }

  // 2. Jika bukan sesi aktif, wajib dimulai dengan "!"
  if (!text.startsWith('!')) return false;

  const args = text.split(' ');
  const commandName = args[0].toLowerCase();
  const commandArgs = args.slice(1);

  // Khusus untuk reset sesi
  if (commandName === '!cancel') {
    await supabase.from('bot_sessions').delete().eq('sender_phone', senderPhone);
    console.log(`[BotSession] 🗑️ Session cancelled for ${senderPhone}`);
    await sendTextMessage(phoneId, senderPhone, '✅ Percakapan dibatalkan.');
    return true;
  }

  const command = COMMANDS[commandName];
  
  if (!command) {
    // Abaikan jika bukan command yang dikenali (bisa jadi balasan biasa ke customer, tapi karena admin, kita cek)
    return false;
  }

  if (!command.enabled) {
    await sendTextMessage(phoneId, senderPhone, `⚠️ Command *${commandName}* sedang dinonaktifkan.`);
    return true;
  }

  try {
    // Jangan kirim "Memproses..." untuk command interaktif
    if (commandName !== '!buat_invoice' && commandName !== '!inv_lowongan' && commandName !== '!inv_umum') {
      await sendTextMessage(phoneId, senderPhone, `⏳ Memproses *${commandName}*...`);
    }

    await command.execute(phoneId, senderPhone, commandArgs);
    console.log(`[Command] ✅ ${commandName} executed successfully for ${senderPhone}`);
    return true;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Command] ❌ Error executing ${commandName}:`, errorMsg);
    await sendTextMessage(phoneId, senderPhone, `❌ *Error saat menjalankan ${commandName}:*\n\n\`${errorMsg}\``);
    return false;
  }
}

// ============================================
// STATE MACHINE HANDLER
// ============================================

async function handleConversationState(phoneId: string, senderPhone: string, text: string, session: any): Promise<boolean> {
  const state = session.state;
  const sessionPhoneId = session.phone_id; // phoneId yang tersimpan di sesi (bisa berbeda dari param phoneId)
  let data = session.data || {};
  let nextState = 'IDLE';
  let reply = '';
  const inputText = text.trim();

  console.log(`[StateMachine] 🔄 Processing | state=${state} | input="${inputText.substring(0, 50)}" | phoneId(webhook)=${phoneId} | phoneId(session)=${sessionPhoneId}`);

  try {
    // === ALUR LOWONGAN ===
    if (state === 'LOWONGAN_AWAIT_NAME') {
      data.customer_name = text.trim();
      nextState = 'LOWONGAN_AWAIT_WA';
      reply = '📱 Masukkan *Nomor WA Klien* (Contoh: 628...):';
    } 
    else if (state === 'LOWONGAN_AWAIT_WA') {
      data.wa = text.replace(/[^0-9]/g, '');
      nextState = 'LOWONGAN_AWAIT_AMOUNT';
      reply = '💰 Masukkan *Nominal / Harga* (Angka saja, misal 150000):';
    } 
    else if (state === 'LOWONGAN_AWAIT_AMOUNT') {
      data.amount = parseInt(text.replace(/[^0-9]/g, ''));
      const orderId = `INV-${Date.now().toString().slice(-6)}`;
      
      // Save to DB
      await supabase.from('payment_orders').insert({
        order_id: orderId,
        customer_name: data.customer_name,
        customer_whatsapp: data.wa,
        customer_company: data.customer_name,
        package_id: 999,
        package_name: 'Loker Highlight',
        amount: data.amount,
        total_amount: data.amount,
        status: 'PENDING'
      });

      const payUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infolokerjombang.net'}/pay/${orderId}`;
      
      const clientMsg = `Halo Kak ${data.customer_name} 👋\n\nBerikut adalah link Invoice untuk pemasangan *Loker Highlight* senilai *Rp ${data.amount.toLocaleString('id-ID')}*.\n\n🔗 ${payUrl}\n\nKlik link di atas untuk melihat detail tagihan dan *mengunduh PDF Invoice* secara otomatis.\n\nTerima kasih! 🙏`;
      
      reply = `✅ *Invoice Lowongan Berhasil Dibuat!*\n\nID: ${orderId}\nKlien: ${data.customer_name}\nNominal: Rp ${data.amount.toLocaleString('id-ID')}\n\n_Silakan forward pesan di bawah ini ke klien:_\n\n${clientMsg}`;
      nextState = 'IDLE';
    }
    
    // === ALUR UMUM (LENGKAP) ===
    else if (state === 'UMUM_AWAIT_NAME') {
      data.customer_name = text.trim();
      nextState = 'UMUM_AWAIT_WA';
      reply = '📱 Masukkan *Nomor WA Klien*:';
    }
    else if (state === 'UMUM_AWAIT_WA') {
      data.wa = text.replace(/[^0-9]/g, '');
      nextState = 'UMUM_AWAIT_PACKAGE';
      reply = '📦 Masukkan *Nama Paket / Layanan Utama*:';
    }
    else if (state === 'UMUM_AWAIT_PACKAGE') {
      data.package_name = text.trim();
      nextState = 'UMUM_AWAIT_PRICE';
      reply = '💰 Masukkan *Harga Layanan Utama* (Angka saja):';
    }
    else if (state === 'UMUM_AWAIT_PRICE') {
      data.amount = parseInt(text.replace(/[^0-9]/g, ''));
      nextState = 'UMUM_AWAIT_ADDON';
      reply = '➕ Masukkan *Tambahan / Add-ons* (Ketik "TIDAK" jika tidak ada):';
    }
    else if (state === 'UMUM_AWAIT_ADDON') {
      if (text.toUpperCase() === 'TIDAK') {
        data.addons = [];
        data.addon_names = [];
        nextState = 'UMUM_AWAIT_STATUS';
        reply = '💳 Ketik *1* jika LUNAS, ketik *2* jika PENDING:';
      } else {
        data.addon_names = [text.trim()];
        nextState = 'UMUM_AWAIT_ADDON_PRICE';
        reply = '💰 Masukkan *Harga Tambahan* tersebut (Angka saja):';
      }
    }
    else if (state === 'UMUM_AWAIT_ADDON_PRICE') {
      data.addons = [parseInt(text.replace(/[^0-9]/g, ''))];
      nextState = 'UMUM_AWAIT_STATUS';
      reply = '💳 Ketik *1* jika LUNAS, ketik *2* jika PENDING:';
    }
    else if (state === 'UMUM_AWAIT_STATUS') {
      const isLunas = text.trim() === '1';
      const status = isLunas ? 'PAID' : 'PENDING';
      const orderId = `INV-${Date.now().toString().slice(-6)}`;
      const addonTotal = (data.addons || []).reduce((a: number,b: number) => a+b, 0);
      const totalAmount = data.amount + addonTotal;

      await supabase.from('payment_orders').insert({
        order_id: orderId,
        customer_name: data.customer_name,
        customer_whatsapp: data.wa,
        customer_company: data.customer_name,
        package_id: 999,
        package_name: data.package_name,
        amount: data.amount,
        total_amount: totalAmount,
        addons: data.addons || [],
        addon_names: data.addon_names || [],
        status: status,
        paid_at: isLunas ? new Date().toISOString() : null
      });

      const payUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://infolokerjombang.net'}/pay/${orderId}`;
      
      let clientMsg = `Halo Kak ${data.customer_name} 👋\n\nBerikut adalah link Invoice untuk *${data.package_name}* senilai *Rp ${totalAmount.toLocaleString('id-ID')}*.\n\n🔗 ${payUrl}\n\nKlik link di atas untuk melihat rincian tagihan dan *mengunduh PDF Invoice*.`;
      if (isLunas) {
        clientMsg = `Halo Kak ${data.customer_name} 👋\n\nTerima kasih, pembayaran Anda untuk *${data.package_name}* senilai *Rp ${totalAmount.toLocaleString('id-ID')}* telah kami terima (LUNAS).\n\nAnda dapat mengunduh bukti PDF Invoice melalui link berikut:\n🔗 ${payUrl}`;
      }

      reply = `✅ *Invoice Lengkap Berhasil Dibuat!*\n\nID: ${orderId}\nTotal: Rp ${totalAmount.toLocaleString('id-ID')}\nStatus: *${status}*\n\n_Silakan forward pesan di bawah ini ke klien:_\n\n${clientMsg}`;
      nextState = 'IDLE';
    }
    else {
      reply = '❌ Sesi tidak valid. Ketik *!cancel* untuk membatalkan.';
    }

    // Update session state — gunakan sender_phone saja untuk match
    // karena phoneId bisa berbeda antara text vs button webhook dari KirimDev
    if (nextState === 'IDLE') {
      await supabase.from('bot_sessions').delete().eq('sender_phone', senderPhone);
      console.log(`[StateMachine] 🗑️ Session completed & deleted for ${senderPhone}`);
    } else {
      const { error: updateError } = await supabase
        .from('bot_sessions')
        .update({ state: nextState, data, updated_at: new Date().toISOString() })
        .eq('sender_phone', senderPhone);
      if (updateError) {
        console.error(`[StateMachine] ❌ Failed to update session for ${senderPhone}:`, updateError.message);
      } else {
        console.log(`[StateMachine] ✅ Session updated for ${senderPhone} | nextState=${nextState}`);
      }
    }

    if (reply) {
      await sendTextMessage(phoneId, senderPhone, reply);
    }
    return true;

  } catch (error) {
    console.error('State Machine Error:', error);
    await sendTextMessage(phoneId, senderPhone, `❌ Terjadi kesalahan pengisian form. Ketik *!cancel* untuk mereset.`);
    return true;
  }
}
