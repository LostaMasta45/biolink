import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emitNotification } from "@/services/whatsapp-notification-service";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Send Telegram notification with photo (server-side)
async function sendTelegramWithPhoto(photoUrl: string, caption: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) return;

    try {
        // Try sending photo first
        const photoRes = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                photo: photoUrl,
                caption,
                parse_mode: "HTML",
            }),
        });

        if (!photoRes.ok) {
            // Fallback to text with link
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `${caption}\n\n📎 <a href="${photoUrl}">Lihat Poster</a>`,
                    parse_mode: "HTML",
                    disable_web_page_preview: false,
                }),
            });
        }
    } catch (err) {
        console.error("Telegram notification failed:", err);
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { whatsapp_number, poster_urls, caption } = body;

        if (!whatsapp_number) {
            return NextResponse.json(
                { success: false, error: "Nomor WhatsApp wajib diisi" },
                { status: 400 }
            );
        }

        if (!poster_urls || !Array.isArray(poster_urls) || poster_urls.length === 0) {
            return NextResponse.json(
                { success: false, error: "Minimal 1 poster harus diupload" },
                { status: 400 }
            );
        }

        const supabase = getSupabase();

        // Format phone number to start with 0 for consistent searching, or try both
        let formattedSearchPhone = whatsapp_number.replace(/[^0-9]/g, '');
        if (formattedSearchPhone.startsWith('62')) {
            formattedSearchPhone = '0' + formattedSearchPhone.substring(2);
        }

        // Find the LATEST 'draft' posting_queue entry linked to this WA number
        const { data: postingEntries, error: findError } = await supabase
            .from("posting_queue")
            .select("*")
            .eq("status", "draft")
            // Use ilike to match numbers that might have different prefixes
            .ilike("whatsapp_number", `%${formattedSearchPhone.substring(1)}%`)
            .order("created_at", { ascending: false })
            .limit(1);

        const postingEntry = postingEntries?.[0];

        if (findError || !postingEntry) {
            console.error("Posting entry not found for whatsapp:", whatsapp_number);
            return NextResponse.json(
                { success: false, error: "Data pesanan tidak ditemukan atau poster sudah pernah diupload untuk nomor ini." },
                { status: 404 }
            );
        }

        // Update the posting entry with poster URLs and caption, change status to queued
        const posterUrl = poster_urls.join('|'); // Pipe-separated format (existing pattern)

        const updateData: Record<string, unknown> = {
            poster_url: posterUrl,
            status: "queued", // Move from draft → queued (ready to post)
            updated_at: new Date().toISOString(),
        };

        if (caption && caption.trim()) {
            updateData.caption = caption.trim();
            // Append caption to notes
            updateData.notes = postingEntry.notes
                ? `${postingEntry.notes}\nCaption: ${caption.trim()}`
                : `Caption: ${caption.trim()}`;
        }

        const { error: updateError } = await supabase
            .from("posting_queue")
            .update(updateData)
            .eq("id", postingEntry.id);

        if (updateError) {
            console.error("Failed to update posting entry:", updateError);
            return NextResponse.json(
                { success: false, error: "Gagal mengupdate data posting" },
                { status: 500 }
            );
        }

        // Also update payment_orders to mark poster as uploaded
        if (postingEntry.order_id) {
            await supabase
                .from("payment_orders")
                .update({
                    synced_to_posting: true,
                    related_posting_id: postingEntry.id,
                    updated_at: new Date().toISOString(),
                })
                .eq("order_id", postingEntry.order_id);
        }

        // Get payment order details for notifications
        let paymentOrder = null;
        if (postingEntry.order_id) {
            const { data } = await supabase
                .from("payment_orders")
                .select("*")
                .eq("order_id", postingEntry.order_id)
                .single();
            paymentOrder = data;
        }

        const customerName = paymentOrder?.customer_name || postingEntry.company_name;
        const companyName = postingEntry.company_name;
        const packageName = paymentOrder?.package_name || "Paket Posting";
        const totalFormatted = (paymentOrder?.total_amount || postingEntry.total_price || 0).toLocaleString("id-ID");

        // Send Telegram notification to admin with poster
        const telegramCaption = `
<b>🖼️ POSTER LOWONGAN DITERIMA</b>

━━━━━━━━━━━━━━━━━━
📋 <b>Order ID:</b> ${postingEntry.order_id || 'Manual/Unknown'}
━━━━━━━━━━━━━━━━━━

👤 <b>Nama:</b> ${customerName}
🏢 <b>Perusahaan:</b> ${companyName}
📦 <b>Paket:</b> ${packageName}
💰 <b>Total:</b> Rp ${totalFormatted}
📅 <b>Jadwal:</b> ${postingEntry.scheduled_date}
${caption ? `\n📝 <b>Caption:</b> ${caption}` : ""}
${poster_urls.length > 1 ? `\n🖼️ <b>Jumlah Poster:</b> ${poster_urls.length} file` : ""}

✅ Status: <b>SIAP POSTING</b>
━━━━━━━━━━━━━━━━━━
🔔 Poster sudah masuk antrian!
        `.trim();

        // Send first poster as photo, rest as text links
        await sendTelegramWithPhoto(poster_urls[0], telegramCaption);

        // If multiple posters, send remaining as separate messages
        if (poster_urls.length > 1) {
            for (let i = 1; i < poster_urls.length; i++) {
                await sendTelegramWithPhoto(
                    poster_urls[i],
                    `📎 Poster ${i + 1}/${poster_urls.length} — ${companyName}`
                );
            }
        }

        // Send WhatsApp confirmation through Notification Center
        if (postingEntry.whatsapp_number) {
            const notification = await emitNotification({
                eventKey: "poster.received.customer",
                customerPhone: postingEntry.whatsapp_number,
                dedupeId: postingEntry.order_id || String(postingEntry.id),
                variables: {
                    customer_name: customerName,
                    company_name: companyName,
                    package_name: packageName,
                    order_id: postingEntry.order_id || "-",
                    poster_count: poster_urls.length,
                    scheduled_date: postingEntry.scheduled_date || "-",
                },
            });
            if (notification.status === "failed") console.error("WhatsApp poster confirmation failed:", notification.error);
        }

        return NextResponse.json({
            success: true,
            data: {
                posting_id: postingEntry.id,
                poster_count: poster_urls.length,
                status: "queued",
            },
        });
    } catch (error) {
        console.error("Upload Poster Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
