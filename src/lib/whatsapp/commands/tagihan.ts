import { createClient } from '@supabase/supabase-js';
import type { CommandContext } from '../types';

// ============================================
// Command: !tagihan [INVOICE_NUMBER]
// Cek detail tagihan / invoice
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

export async function handleTagihan(args: string[], context: CommandContext): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Jika tidak ada argument, tampilkan tagihan pending
  if (args.length === 0) {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .in('status', ['draft', 'sent'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw new Error(`Database Error: ${error.message}`);
    if (!invoices || invoices.length === 0) {
      return `✅ *Tidak ada tagihan pending!*\n\nSemua invoice sudah lunas atau belum ada invoice.`;
    }

    let result = `📋 *TAGIHAN BELUM LUNAS*\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    let totalPending = 0;

    invoices.forEach((inv, i) => {
      const statusEmoji = inv.status === 'sent' ? '📤' : '📝';
      result += `${i + 1}. ${statusEmoji} *${inv.invoice_number || inv.number}*\n`;
      result += `   👤 ${inv.client_name}\n`;
      result += `   💰 ${formatRp(inv.total)}\n`;
      result += `   📅 ${new Date(inv.created_at).toLocaleDateString('id-ID')}\n\n`;
      totalPending += inv.total || 0;
    });

    result += `━━━━━━━━━━━━━━━━━━━━\n`;
    result += `💰 Total Pending: *${formatRp(totalPending)}*\n`;
    result += `📊 Jumlah: *${invoices.length}* invoice`;

    return result;
  }

  // Cek invoice spesifik
  const invoiceQuery = args[0];
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .or(`id.eq.${invoiceQuery},invoice_number.ilike.%${invoiceQuery}%,number.ilike.%${invoiceQuery}%`)
    .single();

  if (error || !invoice) {
    return `🔍 Invoice *${invoiceQuery}* tidak ditemukan.\n\nKetik *!tagihan* tanpa argumen untuk melihat semua tagihan pending.`;
  }

  const statusMap: Record<string, string> = {
    draft: '📝 Draft',
    sent: '📤 Terkirim',
    paid: '✅ Lunas',
    cancelled: '❌ Dibatalkan',
  };

  let itemsText = '';
  const items = invoice.invoice_items || invoice.items || [];
  items.forEach((item: any, i: number) => {
    itemsText += `  ${i + 1}. ${item.description}\n`;
    itemsText += `     ${item.quantity}x @ ${formatRp(item.price)} = ${formatRp(item.amount)}\n`;
  });

  return `🧾 *DETAIL INVOICE*
━━━━━━━━━━━━━━━━━━━━
📋 No: *${invoice.invoice_number || invoice.number}*
📌 Status: ${statusMap[invoice.status] || invoice.status}

👤 *Klien:* ${invoice.client_name}
${invoice.client_phone ? `📱 *Telp:* ${invoice.client_phone}` : ''}

📦 *Item:*
${itemsText || '  Tidak ada item'}
━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL: ${formatRp(invoice.total)}*

📅 Dibuat: ${new Date(invoice.created_at).toLocaleDateString('id-ID')}
${invoice.due_date ? `⏰ Jatuh Tempo: ${new Date(invoice.due_date).toLocaleDateString('id-ID')}` : ''}`;
}
