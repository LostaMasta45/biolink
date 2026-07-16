import { NextResponse } from "next/server";
import { auditApiSend } from "@/services/whatsapp-audit-service";
import { getAllAccounts } from "@/lib/whatsapp/kirimdev-client";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { customer_name, customer_whatsapp, package_name, amount } = body;

        const apiKey = process.env.KIRIMDEV_API_KEY;
        let phoneId = process.env.KIRIMDEV_PHONE_ID;

        if (!apiKey || !phoneId) {
            return NextResponse.json({ message: "KIRIMDEV_API_KEY or KIRIMDEV_PHONE_ID belum dikonfigurasi di file .env.local" }, { status: 500 });
        }

        if (!customer_whatsapp) {
            return NextResponse.json({ message: "Nomor WhatsApp wajib diisi" }, { status: 400 });
        }

        // Format phone number to start with 62 (without +)
        let formattedPhone = customer_whatsapp.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '62' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('62')) {
            formattedPhone = '62' + formattedPhone;
        }

        const accounts = await getAllAccounts();
        const adminNumber = accounts[0]?.phoneNumber.replace(/\D/g, '');
        if (formattedPhone === adminNumber && accounts[1]?.phoneId) {
            phoneId = accounts[1].phoneId;
        }

        const totalFormatted = (Number(amount) || 50000).toLocaleString("id-ID");
        const orderId = `TEST-${Date.now()}`;

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
                                { type: "text", text: customer_name || 'Pelanggan' },
                                { type: "text", text: package_name || 'Paket Test' },
                                { type: "text", text: totalFormatted },
                                { type: "text", text: orderId }
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
            source: "legacy_test_wa_page",
            response: responseText.slice(0, 2000),
        });
        if (!res.ok) {
            const errorText = responseText;
            console.error("Test WhatsApp notification failed:", errorText);
            return NextResponse.json({ message: "Gagal mengirim pesan WhatsApp", error: errorText }, { status: 500 });
        }

        return NextResponse.json({ message: "Berhasil mengirim pesan WhatsApp!", target: formattedPhone });
    } catch (error: unknown) {
        console.error("Test WA Error:", error);
        return NextResponse.json({ message: "Terjadi kesalahan internal pada server", error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
