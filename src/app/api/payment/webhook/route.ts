import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { KlikQRISWebhookPayload } from "@/lib/payment-types";
import { getTodayWIB, getTomorrowWIB, generateInvoiceNumber } from "@/lib/utils";
import { sendNotifToAdmin } from "@/lib/whatsapp/kirimdev-client";
import { auditApiSend } from "@/services/whatsapp-audit-service";

interface PaymentNotificationOrder {
    amount: number;
    customer_name?: string;
    package_name?: string;
    order_id: string;
}

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Send Telegram notification directly (server-side, no need for API route)
async function sendTelegramNotification(text: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (!botToken || !chatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
                disable_web_page_preview: true,
            }),
        });
    } catch (err) {
        console.error("Telegram notification failed:", err);
    }
}

// Send WhatsApp notification using Kirimdev API
async function sendWhatsappNotification(phoneNumber: string, order: PaymentNotificationOrder) {
    const apiKey = process.env.KIRIMDEV_API_KEY;
    const phoneId = process.env.KIRIMDEV_PHONE_ID;

    if (!apiKey || !phoneId || !phoneNumber) {
        console.warn("KIRIMDEV credentials not set or phone number missing.");
        return;
    }

    // Format phone number to start with 62 (without +)
    let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '62' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('62')) {
        formattedPhone = '62' + formattedPhone;
    }
    const totalFormatted = order.amount.toLocaleString("id-ID");
    
    try {
        const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: formattedPhone,
                type: "template",
                template: {
                    name: "invoice_pembayaran",
                    language: { code: "id" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: order.customer_name || 'Pelanggan' },
                                { type: "text", text: order.package_name || 'Paket Anda' },
                                { type: "text", text: totalFormatted },
                                { type: "text", text: order.order_id }
                            ]
                        }
                    ]
                }
            }),
        });

        const responseText = await res.text();
        await auditApiSend({
            customer: formattedPhone,
            senderPhoneId: phoneId,
            messageType: "template",
            success: res.ok,
            httpStatus: res.status,
            latencyMs: 0,
            error: res.ok ? undefined : responseText,
            source: "payment_success_customer_legacy",
            correlationId: String(order.order_id ?? ""),
            response: responseText.slice(0, 2000),
        });
        if (!res.ok) {
            console.error("WhatsApp notification failed:", responseText);
        } else {
            console.log("WhatsApp notification sent successfully to", formattedPhone);
        }
    } catch (err) {
        console.error("WhatsApp notification error:", err);
    }
}

export async function POST(request: Request) {
    try {
        const body: KlikQRISWebhookPayload = await request.json();
        console.log("📥 Webhook received:", JSON.stringify(body, null, 2));

        const { data } = body;
        if (!data || !data.order_id) {
            return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
        }

        const supabase = getSupabase();

        // Find the order in our database
        const { data: order, error: findError } = await supabase
            .from("payment_orders")
            .select("*")
            .eq("order_id", data.order_id)
            .single();

        if (findError || !order) {
            console.error("Order not found:", data.order_id);
            // Return 200 so KlikQRIS doesn't retry
            return NextResponse.json({ message: "Order not found" }, { status: 200 });
        }

        // Validate signature (double security)
        if (order.signature && data.signature && order.signature !== data.signature) {
            console.error("Signature mismatch for:", data.order_id);
            return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
        }

        // Idempotency check — if already PAID, skip
        if (order.status === "PAID") {
            console.log("Order already PAID, skipping:", data.order_id);
            return NextResponse.json({ message: "Already processed" }, { status: 200 });
        }

        const webhookStatus = data.status?.toUpperCase();

        if (webhookStatus === "PAID" || webhookStatus === "SUCCESS") {
            // === PAYMENT SUCCESS ===
            const updateData = {
                status: "PAID",
                paid_at: data.payment_date || new Date().toISOString(),
                total_amount: data.amount_paid || order.total_amount,
                updated_at: new Date().toISOString(),
            };

            await supabase
                .from("payment_orders")
                .update(updateData)
                .eq("order_id", data.order_id);
                
            // === WhatsApp Notification to Admin ===
            try {
                const notifMsg = `✅ *PEMBAYARAN BERHASIL!* 🎉\n\nUang sejumlah *Rp ${(data.amount_paid || order.total_amount).toLocaleString('id-ID')}* telah masuk via QRIS.\n\n*Klien:* ${order.customer_name} (${order.customer_company})\n*Layanan:* ${order.package_name}\n*Order ID:* ${data.order_id}\n\nLayanan sudah masuk antrean posting (Draft). Cek dashboard untuk memproses poster.`;
                await sendNotifToAdmin(notifMsg);
            } catch (waErr) {
                console.error("WA Notif Failed:", waErr);
            }

            // Auto-sync to finance (transactions table)
            try {
                const { data: txData } = await supabase
                    .from("transactions")
                    .insert({
                        mode: "business",
                        type: "income",
                        amount: data.amount_paid || order.amount,
                        category: "posting",
                        description: `Pembayaran QRIS - ${order.package_name} - ${order.customer_company}`,
                        client: order.customer_company,
                        date: getTodayWIB(),
                        status: "paid",
                        payment_method: "ewallet",
                    })
                    .select()
                    .single();

                if (txData) {
                    await supabase
                        .from("payment_orders")
                        .update({
                            synced_to_finance: true,
                            related_transaction_id: txData.id,
                        })
                        .eq("order_id", data.order_id);
                }
            } catch (err) {
                console.error("Finance sync failed:", err);
            }

            // Auto-create posting queue entry (draft — waiting for poster upload)
            try {
                const scheduledDate = getTomorrowWIB();

                const { data: postData } = await supabase
                    .from("posting_queue")
                    .insert({
                        company_name: order.customer_company,
                        whatsapp_number: order.customer_whatsapp,
                        scheduled_date: scheduledDate,
                        scheduled_time: "pagi",
                        package_id: order.package_id,
                        addons: order.addons || [],
                        total_price: data.amount_paid || order.amount,
                        status: "draft",
                        order_id: data.order_id,
                        notes: `Auto dari QRIS | ${order.customer_name} | Order: ${data.order_id}`,
                    })
                    .select()
                    .single();

                if (postData) {
                    await supabase
                        .from("payment_orders")
                        .update({
                            synced_to_posting: true,
                            related_posting_id: postData.id,
                        })
                        .eq("order_id", data.order_id);
                }
            } catch (err) {
                console.error("Posting queue sync failed:", err);
            }

            // Auto-create invoice
            try {
                const invoiceNumber = generateInvoiceNumber(Math.floor(Math.random() * 1000));
                const totalAmount = data.amount_paid || order.amount;

                const { data: invoiceData, error: invoiceError } = await supabase
                    .from("invoices")
                    .insert({
                        invoice_number: invoiceNumber,
                        client_name: order.customer_name,
                        client_phone: order.customer_whatsapp,
                        client_address: order.customer_company,
                        sender_name: "InfoLokerJombang",
                        sender_address: "Jombang, Jawa Timur",
                        sender_contact: "@infolokerjombang",
                        invoice_date: getTodayWIB(),
                        subtotal: totalAmount,
                        discount_type: "nominal",
                        discount_value: 0,
                        discount_amount: 0,
                        tax_enabled: false,
                        tax_percent: 0,
                        tax_amount: 0,
                        total: totalAmount,
                        bank_name: "QRIS",
                        template: "modern",
                        status: "paid",
                        notes: `Order ID: ${data.order_id}`,
                    })
                    .select()
                    .single();

                if (invoiceData && !invoiceError) {
                    await supabase.from("invoice_items").insert({
                        invoice_id: invoiceData.id,
                        description: `${order.package_name}${order.addon_names?.length > 0 ? ' + ' + order.addon_names.join(', ') : ''}`,
                        quantity: 1,
                        price: totalAmount,
                        sort_order: 0,
                    });
                } else if (invoiceError) {
                    console.error("Invoice creation failed:", invoiceError);
                }
            } catch (err) {
                console.error("Invoice sync failed:", err);
            }

            // Send Telegram notification
            const totalFormatted = (data.amount_paid || order.total_amount || order.amount).toLocaleString("id-ID");
            const telegramMessage = `
<b>💳 PEMBAYARAN BARU VIA QRIS</b>

━━━━━━━━━━━━━━━━━━
📋 <b>Order ID:</b> ${data.order_id}
✅ <b>Status:</b> LUNAS
━━━━━━━━━━━━━━━━━━

👤 <b>Nama:</b> ${order.customer_name}
📱 <b>WhatsApp:</b> ${order.customer_whatsapp}
🏢 <b>Perusahaan:</b> ${order.customer_company}

📦 <b>Paket:</b> ${order.package_name}
${order.addon_names?.length > 0 ? `➕ <b>Add-on:</b> ${order.addon_names.join(", ")}` : ""}

💰 <b>Total Bayar:</b>
<code>Rp ${totalFormatted}</code>

📅 <b>Dibayar:</b> ${data.payment_date || new Date().toLocaleString("id-ID")}
━━━━━━━━━━━━━━━━━━
🔔 Segera proses posting!
            `.trim();

            await sendTelegramNotification(telegramMessage);

            // Send WhatsApp notification to Customer
            await sendWhatsappNotification(order.customer_whatsapp, order);

        } else if (webhookStatus === "EXPIRED") {
            // === PAYMENT EXPIRED ===
            await supabase
                .from("payment_orders")
                .update({
                    status: "EXPIRED",
                    updated_at: new Date().toISOString(),
                })
                .eq("order_id", data.order_id);
        }

        // MUST return 200 OK for KlikQRIS to stop retrying
        return NextResponse.json({ message: "OK" }, { status: 200 });
    } catch (error) {
        console.error("Webhook Error:", error);
        // Still return 200 to prevent retries
        return NextResponse.json({ message: "Error handled" }, { status: 200 });
    }
}
