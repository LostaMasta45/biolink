import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = envFile.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {} as Record<string, string>);

Object.assign(process.env, envVars);

async function sendInteractiveWA() {
    const apiKey = process.env.KIRIMDEV_API_KEY;
    const phoneId = process.env.KIRIMDEV_PHONE_ID;
    
    if (!apiKey || !phoneId) {
        console.error("❌ KIRIMDEV_API_KEY or KIRIMDEV_PHONE_ID is missing in .env.local");
        return;
    }

    // Nomor tujuan sesuai request
    const targetPhone = "62895623834500";
    
    console.log(`⏳ Mengirim pesan WA interaktif ke ${targetPhone}...`);

    const messageBody = `Halo Kak 👋\n\nTerima kasih telah melakukan pemesanan layanan di *Brand*!\nPesanan Anda dengan nomor *#ORD-12345* telah kami terima dengan baik.\n\n*Berikut adalah ringkasan tagihan Anda:*\n📦 Layanan: Paket Premium\n💰 Total Tagihan: Rp 150.000\n⏳ Batas Pembayaran: Besok, 12:00 WIB\n\n🔗 *Bayar Sekarang via Link ini:* https://klikqris.com/pay/12345\n\nSilakan klik tombol di bawah ini jika butuh bantuan atau ingin membatalkan pesanan. 👇`;

    try {
        const res = await fetch(`https://api.kirimdev.com/v1/${phoneId}/messages`, {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: targetPhone,
                type: "interactive",
                interactive: {
                    type: "cta_url",
                    body: {
                        text: "Halo Kak 👋\n\nTerima kasih telah melakukan pemesanan layanan di *Brand*!\nPesanan Anda dengan nomor *#ORD-12345* telah kami terima dengan baik.\n\n*Berikut adalah ringkasan tagihan Anda:*\n📦 Layanan: Paket Premium\n💰 Total Tagihan: Rp 150.000\n⏳ Batas Pembayaran: Besok, 12:00 WIB\n\nSilakan selesaikan pembayaran Anda agar pesanan dapat segera kami proses. 👇"
                    },
                    action: {
                        name: "cta_url",
                        parameters: {
                            display_text: "Bayar Sekarang",
                            url: "https://klikqris.com/pay/12345"
                        }
                    }
                }
            }),
        });

        const data = await res.text();
        if (res.ok) {
            console.log("✅ Berhasil mengirim pesan teks WhatsApp!");
            console.log("Response:", data);
        } else {
            console.error("❌ Gagal mengirim pesan WhatsApp:", res.status);
            console.error(data);
        }
    } catch (error) {
        console.error("❌ Terjadi kesalahan:", error);
    }
}

sendInteractiveWA();
