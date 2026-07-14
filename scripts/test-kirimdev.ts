import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = envFile.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {} as Record<string, string>);

Object.assign(process.env, envVars);

async function testWA() {
    const apiKey = process.env.KIRIMDEV_API_KEY;
    const phoneId = process.env.KIRIMDEV_PHONE_ID;

    if (!apiKey || !phoneId) {
        console.error("❌ KIRIMDEV_API_KEY or KIRIMDEV_PHONE_ID is missing in .env.local");
        return;
    }

    const customer_whatsapp = "083122866975";
    const customer_name = "Bos Antigravity";
    const package_name = "Paket VIP Seumur Hidup";
    const totalFormatted = "Rp 99.000";
    const orderId = `TEST-${Date.now()}`;

    console.log(`⏳ Mengirim WA ke ${customer_whatsapp}...`);

    try {
        const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: "6283122866975",
                type: "template",
                template: {
                    name: "invoice_pembayaran",
                    language: { code: "id" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: customer_name },
                                { type: "text", text: package_name },
                                { type: "text", text: totalFormatted },
                                { type: "text", text: orderId }
                            ]
                        }
                    ]
                }
            }),
        });

        const data = await res.text();
        if (res.ok) {
            console.log("✅ Berhasil mengirim pesan WhatsApp!");
            console.log("Response:", data);
        } else {
            console.error("❌ Gagal mengirim pesan WhatsApp:", res.status);
            console.error(data);
        }
    } catch (error) {
        console.error("❌ Terjadi kesalahan:", error);
    }
}

testWA();
