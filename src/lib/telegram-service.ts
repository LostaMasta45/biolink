import { type QueuePost, type Transaction } from "./types";

/**
 * Send a text message via the internal API route
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
    try {
        const response = await fetch("/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to send Telegram message:", error);
        return false;
    }
}

/**
 * Send a photo via the internal API route
 */
export async function sendTelegramPhoto(photoUrl: string, caption: string): Promise<boolean> {
    try {
        const response = await fetch("/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photoUrl, caption }),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to send Telegram photo:", error);
        return false;
    }
}

// ============================================
// Formatting Helpers
// ============================================

export function formatNewLokerMessage(post: QueuePost): string {
    const statusEmoji = post.status === "posted" ? "✅" : post.status === "queued" ? "⏳" : "📝";
    const packageInfo = post.package_id === 1 ? "Paket A (Hemat)" : post.package_id === 2 ? "Paket B (Populer)" : "Paket C (Sultan)";

    return `
<b>${statusEmoji} INFO LOKER BARU (${post.status?.toUpperCase()})</b>

🏢 <b>Perusahaan:</b> ${post.company_name}
📱 <b>WhatsApp:</b> ${post.whatsapp_number}
📅 <b>Jadwal:</b> ${post.scheduled_date} (${post.scheduled_time})
📦 <b>Paket:</b> ${packageInfo}
💰 <b>Total:</b> Rp ${post.total_price.toLocaleString('id-ID')}

<i>Catatan: ${post.notes || "-"}</i>
    `.trim();
}

export function formatStatusChangeMessage(post: QueuePost, oldStatus: string, newStatus: string): string {
    return `
<b>🔄 STATUS UPDATE</b>

🏢 <b>${post.company_name}</b>
Perubahan status: <i>${oldStatus}</i> ➡️ <b>${newStatus.toUpperCase()}</b>

📅 Jadwal: ${post.scheduled_date}
    `.trim();
}

export function formatTransactionMessage(transaction: any): string {
    const typeEmoji = transaction.type === "income" ? "📈" : "📉";
    const amount = Number(transaction.amount).toLocaleString('id-ID');

    return `
<b>${typeEmoji} LAPORAN KEUANGAN BARU</b>

💰 <b>Nominal:</b> Rp ${amount}
🏷️ <b>Kategori:</b> ${transaction.category}
📝 <b>Ket:</b> ${transaction.description}
👤 <b>Klien:</b> ${transaction.client || "-"}

<i>Tercatat pada: ${new Date().toLocaleString('id-ID')}</i>
    `.trim();
}

export function formatInvoiceMessage(invoice: any, isUpdate: boolean = false): string {
    const statusMap: Record<string, { emoji: string; text: string }> = {
        draft: { emoji: "📝", text: "Draft" },
        sent: { emoji: "📤", text: "Terkirim" },
        paid: { emoji: "✅", text: "LUNAS" },
        cancelled: { emoji: "❌", text: "Dibatalkan" },
    };

    const status = statusMap[invoice.status] || { emoji: "📋", text: invoice.status };
    const total = Number(invoice.total).toLocaleString('id-ID');
    const actionEmoji = isUpdate ? "🔄" : "🧾";
    const actionText = isUpdate ? "INVOICE DIUPDATE" : "INVOICE BARU";

    // Build items summary
    const itemsSummary = invoice.items?.slice(0, 3).map((item: any) =>
        `   • ${item.description} (${item.quantity}x)`
    ).join('\n') || "   • -";
    const moreItems = invoice.items?.length > 3 ? `\n   <i>...dan ${invoice.items.length - 3} item lainnya</i>` : "";

    return `
<b>${actionEmoji} ${actionText}</b>

━━━━━━━━━━━━━━━━━━
📋 <b>No. Invoice:</b> ${invoice.invoice_number}
${status.emoji} <b>Status:</b> ${status.text}
━━━━━━━━━━━━━━━━━━

👤 <b>Klien:</b> ${invoice.client_name}
${invoice.client_phone ? `📞 <b>Telp:</b> ${invoice.client_phone}` : ""}

📦 <b>Detail Layanan:</b>
${itemsSummary}${moreItems}

💰 <b>Total Tagihan:</b>
<code>Rp ${total}</code>

${invoice.bank_name ? `🏦 <b>Pembayaran:</b> ${invoice.bank_name}` : ""}

<i>📅 ${new Date().toLocaleString('id-ID')}</i>
━━━━━━━━━━━━━━━━━━
🏢 InfoLokerJombang Invoice System
    `.trim();
}
