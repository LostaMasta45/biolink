import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPaidPayment, getPaymentAdminClient } from "@/services/payment-order-service";
import { reportTelegramPosterReceived } from "@/services/telegram-admin-service";
import { emitPosterReceivedNotifications } from "@/services/whatsapp-notification-service";

const uploadPosterSchema = z.object({
  order_id: z.string().min(10).max(80),
  upload_token: z.string().uuid().optional(),
  public_token: z.string().uuid().optional(),
  poster_urls: z.array(z.string().url()).min(1, "Minimal 1 poster harus diupload").max(10, "Maksimal 10 poster"),
  caption: z.string().trim().max(3000).optional(),
}).refine((value) => Boolean(value.upload_token || value.public_token), { message: "Sesi upload tidak valid" });

function isApprovedPosterUrl(value: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base && value.startsWith(`${base}/storage/v1/object/public/posters/`));
}

export async function POST(request: Request) {
  try {
    const parsed = uploadPosterSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Data poster tidak valid" }, { status: 400 });
    const { order_id, upload_token, public_token, poster_urls, caption } = parsed.data;
    if (!poster_urls.every(isApprovedPosterUrl)) {
      return NextResponse.json({ success: false, error: "URL poster tidak valid" }, { status: 400 });
    }

    const supabase = getPaymentAdminClient();
    const { data: order, error: orderError } = await supabase.from("payment_orders").select("*").eq("order_id", order_id).maybeSingle();
    const orderStatus = String(order?.status || "").toUpperCase();
    const tokenMatches = Boolean(order && ((upload_token && upload_token === order.upload_token) || (public_token && public_token === order.public_token)));
    if (orderError) return NextResponse.json({ success: false, error: "Sesi pembayaran tidak dapat dibaca" }, { status: 503 });
    if (!order || !tokenMatches) {
      return NextResponse.json({ success: false, error: "Sesi upload tidak ditemukan atau sudah tidak berlaku" }, { status: 404 });
    }
    if (orderStatus !== "PAID") return NextResponse.json({ success: false, error: "Poster hanya dapat diunggah setelah pembayaran lunas" }, { status: 409 });

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

    await Promise.all([
      reportTelegramPosterReceived({
        order,
        posterUrls: poster_urls,
        scheduledDate: posting.scheduled_date,
        caption,
      }),
      emitPosterReceivedNotifications({
        order,
        posterCount: poster_urls.length,
        posterUrls: poster_urls,
        scheduledDate: posting.scheduled_date,
        caption,
      }),
    ]);

    return NextResponse.json({ success: true, data: { posting_id: posting.id, poster_count: poster_urls.length, status: "queued" } });
  } catch (error) {
    console.error("[PosterUpload]", error);
    return NextResponse.json({ success: false, error: "Poster tidak dapat diproses" }, { status: 500 });
  }
}
