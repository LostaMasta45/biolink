import { createClient } from '@supabase/supabase-js';
import type { CommandContext } from '../types';

// ============================================
// Command: !stats
// Statistik lengkap mingguan / bulanan
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

export async function handleStats(args: string[], context: CommandContext): Promise<string> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const now = new Date();
  
  // Current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Query current month transactions
  const { data: currentTx } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', monthStart.toISOString().split('T')[0])
    .lte('date', now.toISOString().split('T')[0])
    .eq('status', 'paid');

  // Query last month transactions
  const { data: lastTx } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', lastMonthStart.toISOString().split('T')[0])
    .lte('date', lastMonthEnd.toISOString().split('T')[0])
    .eq('status', 'paid');

  // Query total clients
  const { data: clients } = await supabase
    .from('posting_queue')
    .select('whatsapp_number')
    .gte('created_at', monthStart.toISOString());

  const currentIncome = (currentTx || [])
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);
  const currentExpense = (currentTx || [])
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const lastIncome = (lastTx || [])
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  // Calculate growth
  const growth = lastIncome > 0
    ? ((currentIncome - lastIncome) / lastIncome * 100).toFixed(1)
    : '∞';
  const growthEmoji = Number(growth) >= 0 ? '📈' : '📉';

  // Unique clients this month
  const uniqueClients = new Set(clients?.map(c => c.whatsapp_number) || []).size;

  // Top categories
  const categoryMap = new Map<string, number>();
  (currentTx || [])
    .filter(t => t.type === 'income')
    .forEach(t => {
      const current = categoryMap.get(t.category) || 0;
      categoryMap.set(t.category, current + t.amount);
    });

  const topCategories = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let topCatText = '';
  topCategories.forEach(([cat, amount], i) => {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    topCatText += `  ${medals[i]} ${cat}: ${formatRp(amount)}\n`;
  });

  const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return `📊 *STATISTIK ${monthName.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━

💰 *KEUANGAN BULAN INI*
  📈 Total Pemasukan : *${formatRp(currentIncome)}*
  📉 Total Pengeluaran: *${formatRp(currentExpense)}*
  💵 Laba Bersih     : *${formatRp(currentIncome - currentExpense)}*

${growthEmoji} *PERTUMBUHAN*
  Bulan lalu: ${formatRp(lastIncome)}
  Bulan ini : ${formatRp(currentIncome)}
  Growth    : *${growth}%*

👥 *KLIEN*
  Klien unik bulan ini: *${uniqueClients}*
  Total transaksi     : *${(currentTx || []).length}*

🏆 *TOP KATEGORI PEMASUKAN*
${topCatText || '  Belum ada data'}
━━━━━━━━━━━━━━━━━━━━
⏰ ${now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
📱 via ${context.receiverLabel}`;
}
