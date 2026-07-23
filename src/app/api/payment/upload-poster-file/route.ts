import { NextResponse } from "next/server";
import {
  isAllowedPosterMimeType,
  MAX_POSTER_FILE_SIZE_LABEL,
  posterExtensionForMimeType,
} from "@/lib/poster-upload-constants";
import { getPaymentAdminClient } from "@/services/payment-order-service";

export const runtime = "nodejs";

// Compatibility fallback for older clients. New clients upload directly to
// Supabase through a signed upload URL because Vercel Functions accept at most
// 4.5 MB request bodies.
const MAX_PROXY_FILE_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const orderId = String(form.get("order_id") || "");
    const uploadToken = String(form.get("upload_token") || "");
    const publicToken = String(form.get("public_token") || "");
    const file = form.get("file");
    if (!orderId || (!uploadToken && !publicToken) || !(file instanceof File)) return NextResponse.json({ success: false, error: "Data unggah poster tidak lengkap" }, { status: 400 });
    if (!isAllowedPosterMimeType(file.type) || file.size <= 0 || file.size > MAX_PROXY_FILE_SIZE) {
      return NextResponse.json({
        success: false,
        error: `Gunakan halaman upload terbaru untuk poster JPG, PNG, atau WebP hingga ${MAX_POSTER_FILE_SIZE_LABEL}`,
      }, { status: 400 });
    }

    const supabase = getPaymentAdminClient();
    const { data: order, error: orderError } = await supabase.from("payment_orders").select("order_id,status,upload_token,public_token").eq("order_id", orderId).maybeSingle();
    const orderStatus = String(order?.status || "").toUpperCase();
    const tokenMatches = Boolean(order && ((uploadToken && uploadToken === order.upload_token) || (publicToken && publicToken === order.public_token)));
    if (orderError) {
      console.error("[PosterFileUpload] order lookup failed", { orderId, code: orderError.code });
      return NextResponse.json({ success: false, error: "Sesi pembayaran tidak dapat dibaca. Silakan buka ulang link QRIS." }, { status: 503 });
    }
    if (!order) return NextResponse.json({ success: false, error: "Order pembayaran tidak ditemukan. Silakan buka ulang link QRIS." }, { status: 404 });
    if (orderStatus !== "PAID") {
      return NextResponse.json({ success: false, error: `Pembayaran belum berstatus lunas (status: ${orderStatus || "UNKNOWN"})` }, { status: 409 });
    }
    if (!tokenMatches) {
      console.warn("[PosterFileUpload] invalid session", { orderId, orderStatus, hasUploadToken: Boolean(uploadToken), hasPublicToken: Boolean(publicToken) });
      return NextResponse.json({ success: false, error: "Sesi upload kedaluwarsa. Buka ulang link QRIS lalu coba lagi." }, { status: 403 });
    }

    const path = `payment-posters/${orderId}/${Date.now()}-${crypto.randomUUID()}.${posterExtensionForMimeType(file.type)}`;
    const { error: uploadError } = await supabase.storage.from("posters").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("posters").getPublicUrl(path);
    return NextResponse.json({ success: true, data: { url: data.publicUrl } });
  } catch (error) {
    console.error("[PosterFileUpload]", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "File poster tidak dapat diunggah" }, { status: 500 });
  }
}
