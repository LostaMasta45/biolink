import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

export async function POST(request: Request) {
    if (!BOT_TOKEN || !CHAT_ID) {
        return NextResponse.json(
            { error: "Telegram configuration missing on server" },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { text, photoUrl, caption } = body;

        let telegramUrl = "";
        let payload = {};

        if (photoUrl) {
            console.log("Sending photo to Telegram:", photoUrl);
            telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            payload = {
                chat_id: CHAT_ID,
                photo: photoUrl,
                caption: caption || text,
                parse_mode: "HTML"
            };
        } else {
            telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            payload = {
                chat_id: CHAT_ID,
                text: text,
                parse_mode: "HTML",
                disable_web_page_preview: true
            };
        }

        const response = await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Telegram API Error:", data);

            // FALLBACK: If sending photo fails, try sending text only
            if (photoUrl) {
                console.log("Falling back to text message...");
                const fallbackUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
                const fallbackPayload = {
                    chat_id: CHAT_ID,
                    text: `${text}\n\n⚠️ <b>Gagal memuat gambar:</b> <a href="${photoUrl}">Lihat Poster</a>`,
                    parse_mode: "HTML",
                    disable_web_page_preview: false
                };

                const fallbackResponse = await fetch(fallbackUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(fallbackPayload),
                });

                if (fallbackResponse.ok) {
                    return NextResponse.json({ success: true, message: "Sent text fallback" });
                }
            }

            return NextResponse.json({ error: "Failed to send to Telegram", details: data }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
