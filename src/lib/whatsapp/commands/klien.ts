import { createClient } from '@supabase/supabase-js';
import type { CommandContext } from '../types';

// ============================================
// Command: !klien [SEARCH]
// Cari data klien berdasarkan nama atau nomor
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

export async function handleKlien(args: string[], context: CommandContext): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (args.length === 0) {
    // Top 10 klien berdasarkan total spending
    const { data: postings, error } = await supabase
      .from('posting_queue')
      .select('company_name, whatsapp_number, total_price, status')
      .eq('status', 'posted');

    if (error) throw new Error(`Database Error: ${error.message}`);

    // Aggregate by company
    const clientMap = new Map<string, { name: string; phone: string; total: number; count: number }>();
    (postings || []).forEach(p => {
      const key = p.whatsapp_number;
      const current = clientMap.get(key) || { name: p.company_name, phone: p.whatsapp_number, total: 0, count: 0 };
      current.total += p.total_price || 0;
      current.count += 1;
      clientMap.set(key, current);
    });

    const topClients = Array.from(clientMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    if (topClients.length === 0) {
      return `📋 Belum ada data klien.`;
    }

    let result = `👥 *TOP 10 KLIEN*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    topClients.forEach((client, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const prefix = i < 3 ? medals[i] : `${i + 1}.`;
      result += `${prefix} *${client.name}*\n`;
      result += `   📱 ${client.phone}\n`;
      result += `   📦 ${client.count} order | 💰 ${formatRp(client.total)}\n\n`;
    });

    return result.trim();
  }

  // Search specific client
  const search = args.join(' ');
  const { data: postings, error } = await supabase
    .from('posting_queue')
    .select('*')
    .or(`company_name.ilike.%${search}%,whatsapp_number.ilike.%${search}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) throw new Error(`Database Error: ${error.message}`);
  if (!postings || postings.length === 0) {
    return `🔍 Tidak ditemukan klien dengan kata kunci *"${search}"*`;
  }

  let result = `🔍 *HASIL PENCARIAN: "${search}"*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  postings.forEach((p, i) => {
    const statusEmoji: Record<string, string> = {
      draft: '📝', queued: '⏳', posted: '✅', cancelled: '❌'
    };
    result += `${i + 1}. ${statusEmoji[p.status] || '📦'} *${p.company_name}*\n`;
    result += `   📱 ${p.whatsapp_number}\n`;
    result += `   📅 ${p.scheduled_date} | 💰 ${formatRp(p.total_price)}\n\n`;
  });

  return result.trim();
}
