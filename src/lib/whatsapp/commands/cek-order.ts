import { createClient } from '@supabase/supabase-js';
import type { CommandContext } from '../types';

// ============================================
// Command: !cek [ORDER_ID]
// Cek status order berdasarkan ID atau nomor WA
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function formatRp(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}

export async function handleCekOrder(args: string[], context: CommandContext): Promise<string> {
  if (args.length === 0) {
    return `❌ *Format salah!*
    
Cara penggunaan:
  *!cek [ORDER_ID]*  — Cek berdasarkan ID order
  *!cek [NOMOR_WA]*  — Cek semua order dari nomor WA

Contoh:
  !cek ORD-123456
  !cek 08123456789`;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const query = args[0];

  // Cek apakah input adalah nomor telepon (angka saja, > 8 digit)
  const isPhone = /^\d{8,}$/.test(query.replace(/[^0-9]/g, ''));

  if (isPhone) {
    // Search by phone number
    const phone = query.replace(/[^0-9]/g, '');
    const { data: orders, error } = await supabase
      .from('posting_queue')
      .select('*')
      .ilike('whatsapp_number', `%${phone.slice(-8)}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw new Error(`Database Error: ${error.message}`);
    if (!orders || orders.length === 0) {
      return `🔍 Tidak ditemukan order dengan nomor *${query}*`;
    }

    let result = `📋 *ORDER DARI ${query}*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    orders.forEach((order, i) => {
      const statusEmoji: Record<string, string> = {
        draft: '📝', queued: '⏳', posted: '✅', cancelled: '❌'
      };
      result += `${i + 1}. ${statusEmoji[order.status] || '📦'} *${order.company_name}*\n`;
      result += `   ID: \`${order.id.slice(0, 8)}\`\n`;
      result += `   Status: ${order.status?.toUpperCase()}\n`;
      result += `   Jadwal: ${order.scheduled_date}\n`;
      result += `   Total: ${formatRp(order.total_price)}\n\n`;
    });

    return result.trim();
  } else {
    // Search by order ID
    const { data: order, error } = await supabase
      .from('posting_queue')
      .select('*')
      .or(`id.eq.${query},order_id.eq.${query}`)
      .single();

    if (error || !order) {
      return `🔍 Order dengan ID *${query}* tidak ditemukan.\n\nPastikan ID sudah benar, contoh: !cek ORD-123456`;
    }

    const statusEmoji: Record<string, string> = {
      draft: '📝 Draft', queued: '⏳ Dalam Antrian', posted: '✅ Sudah Diposting', cancelled: '❌ Dibatalkan'
    };

    return `📦 *DETAIL ORDER*
━━━━━━━━━━━━━━━━━━━━
🆔 ID: \`${order.id}\`
${order.order_id ? `🔗 Order ID: \`${order.order_id}\`\n` : ''}
🏢 *Perusahaan:* ${order.company_name}
📱 *WhatsApp:* ${order.whatsapp_number}
📅 *Jadwal:* ${order.scheduled_date} (${order.scheduled_time})
${statusEmoji[order.status] ? `📌 *Status:* ${statusEmoji[order.status]}` : `📌 *Status:* ${order.status}`}
💰 *Total:* ${formatRp(order.total_price)}

${order.notes ? `📝 *Catatan:* ${order.notes}` : ''}
━━━━━━━━━━━━━━━━━━━━
⏰ Dibuat: ${new Date(order.created_at).toLocaleString('id-ID')}`;
  }
}
