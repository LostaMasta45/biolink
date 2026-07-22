import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPaidPayment, getPaymentAdminClient } from "@/services/payment-order-service";
import { emitPosterReceivedNotifications } from "@/services/whatsapp-notification-service";

const uploadPosterSchema = z.object({
  order_id: z.string().min(10).max(80),
  upload_token: z.string().uuid(),
  poster_urls: z.array(z.string().url()).min(1, "Minimal 1 poster harus diupload").max(10, "Maksimal 10 poster"),
  caption: z.string().trim().max(3000).optional(),
});

function isApprovedPosterUrl(value: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base && value.startsWith(`${base}/storage/v1/object/public/posters/`));
}

async function sendTelegramWithPhoto(photo: string, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo, caption, parse_mode: "HTML" }),
    });
  } catch (error) {
    console.error("[PosterUpload] Telegram notification failed", error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = uploadPosterSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Data poster tidak valid" }, { status: 400 });
    const { order_id, upload_token, poster_urls, caption } = parsed.data;
    if (!poster_urls.every(isApprovedPosterUrl)) {
      return NextResponse.json({ success: false, error: "URL poster tidak valid" }, { status: 400 });
    }

    const supabase = getPaymentAdminClient();
    const { data: order, error: orderError } = await supabase.from("payment_orders").select("*").eq("order_id", order_id).maybeSingle();
    if (orderError || !order || upload_token !== order.upload_token) {
      return NextResponse.json({ success: false, error: "Sesi upload tidak ditemukan atau sudah tidak berlaku" }, { status: 404 });
    }
    if (order.status !== "PAID") return NextResponse.json({ success: false, error: "Poster hanya dapat diunggah setelah pembayaran lunas" }, { status: 409 });

    let { data: posting, error: postingError } = await supabase.from("posting_queue").select("*").eq("order_id", order_id).maybeSingle();
    // Webhook provider dan halaman upload bisa tiba berdekatan. Pulihkan sinkronisasi
    // lebih dulu agar customer tidak perlu mengulang upload hanya karena antrean belum terbentuk.
    if (!posting && !postingError) {
      await confirmPaidPayment({ orderId: order_id, eventKey: `poster-upload-reconcile:${order_id}`, providerStatus: "PAID" });
      ({ data: posting, error: postingError } = await supabase.from("posting_queue").select("*").eq("order_id", order_id).maybeSingle());
    }
    if (postingError || !posting) return NextResponse.json({ success: false, error: "Antrean posting belum siap. Silakan coba unggah lagi beberapa saat." }, { status: 409 });

    const notes = caption ? `${posting.notes || ""}${posting.notes ? "\n" : ""}Caption: ${caption}` : posting.notes;
    const { error: updateError } = await supabase.from("posting_queue").update({
      poster_url: poster_urls.join("|"), // compatibility with existing posting dashboard
      poster_urls,
      poster_status: "uploaded",
      caption: caption || null,
      notes,
      status: "queued",
      updated_at: new Date().toISOString(),
    }).eq("id", posting.id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("payment_orders").update({ poster_status: "uploaded", related_posting_id: posting.id, synced_to_posting: true, updated_at: new Date().toISOString() }).eq("order_id", order_id);

    const total = Number(order.payable_amount || order.total_amount || order.amount || 0).toLocaleString("id-ID");
    const telegramCaption = `<b>🖼️ POSTER LOWONGAN DITERIMA</b>\n\n<b>Order:</b> ${order_id}\n<b>Perusahaan:</b> ${order.customer_company}\n<b>Paket:</b> ${order.package_name}\n<b>Total:</b> Rp ${total}\n<b>Status:</b> SIAP POSTING`;
    await sendTelegramWithPhoto(poster_urls[0], telegramCaption);

    await emitPosterReceivedNotifications({ order, posterCount: poster_urls.length, scheduledDate: posting.scheduled_date });

    return NextResponse.json({ success: true, data: { posting_id: posting.id, poster_count: poster_urls.length, status: "queued" } });
  } catch (error) {
    console.error("[PosterUpload]", error);
    return NextResponse.json({ success: false, error: "Poster tidak dapat diproses" }, { status: 500 });
  }
}
