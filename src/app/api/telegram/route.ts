import { NextResponse } from "next/server";
import { sendTelegramAdminPhotos, sendTelegramAdminText } from "@/services/telegram-admin-service";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text, photoUrl, caption } = body;
        const result = photoUrl
            ? await sendTelegramAdminPhotos([String(photoUrl)], String(caption || text || ""))
            : await sendTelegramAdminText(String(text || ""));
        if (result.status !== "sent") {
            return NextResponse.json({ error: result.reason || "Failed to send to Telegram" }, { status: result.status === "skipped" ? 503 : 502 });
        }
        return NextResponse.json({ success: true, messageIds: result.messageIds ?? [] });

    } catch (error) {
        console.error("Internal Server Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
