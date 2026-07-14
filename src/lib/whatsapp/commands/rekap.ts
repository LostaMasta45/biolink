import { createClient } from '@supabase/supabase-js';
import type { KirimDevWebhookPayload, CommandContext } from '../types';

// ============================================
// Command: !rekap
// Rekap penjualan hari ini / minggu ini / bulan ini
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

export async function handleRekap(args: string[], context: CommandContext): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const period = args[0] || 'hari';

  let startDate: Date;
  const now = new Date();
  let periodLabel: string;

  switch (period) {
    case 'minggu':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      periodLabel = 'MINGGU INI';
      break;
    case 'bulan':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      periodLabel = 'BULAN INI';
      break;
    case 'hari':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      periodLabel = 'HARI INI';
      break;
  }

  // Query transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', now.toISOString().split('T')[0]);

  if (error) {
    throw new Error(`Database Error: ${error.message}`);
  }

  const data = transactions || [];
  const totalIncome = data
    .filter(t => t.type === 'income' && t.status === 'paid')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = data
    .filter(t => t.type === 'expense' && t.status === 'paid')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const pendingCount = data.filter(t => t.status === 'pending').length;
  const pendingAmount = data
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Query posting antrian
  const { data: postings } = await supabase
    .from('posting_queue')
    .select('id, status')
    .gte('created_at', startDate.toISOString());

  const totalPostings = postings?.length || 0;
  const postedCount = postings?.filter(p => p.status === 'posted').length || 0;
  const queuedCount = postings?.filter(p => p.status === 'queued').length || 0;

  return `📊 *REKAP ${periodLabel}*
━━━━━━━━━━━━━━━━━━━━
📅 ${startDate.toLocaleDateString('id-ID')} — ${now.toLocaleDateString('id-ID')}

💰 *KEUANGAN*
  📈 Pemasukan  : *${formatRp(totalIncome)}*
  📉 Pengeluaran: *${formatRp(totalExpense)}*
  💵 Saldo Bersih: *${formatRp(totalIncome - totalExpense)}*
  ⏳ Pending    : ${pendingCount} transaksi (${formatRp(pendingAmount)})

📋 *POSTING LOKER*
  📝 Total Order : *${totalPostings}*
  ✅ Sudah Posted: *${postedCount}*
  ⏳ Dalam Antrian: *${queuedCount}*

━━━━━━━━━━━━━━━━━━━━
⏰ ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
📱 via ${context.receiverLabel}`;
}
