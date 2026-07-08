import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { customer_name, customer_whatsapp, package_name, amount } = body;

        const apiKey = process.env.KIRIMDEV_API_KEY;
        const phoneId = process.env.KIRIMDEV_PHONE_ID;

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

        if (!res.ok) {
            const errorText = await res.text();
            console.error("Test WhatsApp notification failed:", errorText);
            return NextResponse.json({ message: "Gagal mengirim pesan WhatsApp", error: errorText }, { status: 500 });
        }

        return NextResponse.json({ message: "Berhasil mengirim pesan WhatsApp!", target: formattedPhone });
    } catch (error: any) {
        console.error("Test WA Error:", error);
        return NextResponse.json({ message: "Terjadi kesalahan internal pada server", error: error.message }, { status: 500 });
    }
}
