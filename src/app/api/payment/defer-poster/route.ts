import { NextResponse } from "next/server";
import { z } from "zod";
import { getPaymentAdminClient } from "@/services/payment-order-service";

const schema = z.object({ order_id: z.string().min(10).max(80), upload_token: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Sesi upload tidak valid" }, { status: 400 });
  const supabase = getPaymentAdminClient();
  const { data: order } = await supabase.from("payment_orders").select("order_id,status,upload_token").eq("order_id", parsed.data.order_id).maybeSingle();
  if (!order || order.upload_token !== parsed.data.upload_token || order.status !== "PAID") {
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
