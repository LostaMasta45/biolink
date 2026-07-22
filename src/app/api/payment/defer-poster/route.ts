import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentAdminClient } from "@/services/payment-order-service";

const schema = z.object({ order_id: z.string().min(10).max(80), upload_token: z.string().uuid().optional(), public_token: z.string().uuid().optional() }).refine((value) => Boolean(value.upload_token || value.public_token), { message: "Sesi upload tidak valid" });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Sesi upload tidak valid" }, { status: 400 });
  const supabase = getPaymentAdminClient();
  const { data: order } = await supabase.from("payment_orders").select("order_id,status,upload_token,public_token").eq("order_id", parsed.data.order_id).maybeSingle();
  const tokenMatches = Boolean(order && ((parsed.data.upload_token && parsed.data.upload_token === order.upload_token) || (parsed.data.public_token && parsed.data.public_token === order.public_token)));
  if (!order || !tokenMatches || String(order.status || "").toUpperCase() !== "PAID") {
    return NextResponse.json({ success: false, error: "Pesanan tidak ditemukan" }, { status: 404 });
  }
  const now = new Date().toISOString();
  const [{ error: orderError }, { error: postingError }] = await Promise.all([
    supabase.from("payment_orders").update({ poster_status: "deferred", poster_deferred_at: now, updated_at: now }).eq("order_id", order.order_id),
    supabase.from("posting_queue").update({ poster_status: "deferred", poster_deferred_at: now, updated_at: now }).eq("order_id", order.order_id),
  ]);
  if (orderError || postingError) return NextResponse.json({ success: false, error: "Status unggah nanti tidak dapat disimpan" }, { status: 500 });
  return NextResponse.json({ success: true });
}
