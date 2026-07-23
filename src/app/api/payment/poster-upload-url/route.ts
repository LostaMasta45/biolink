import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ALLOWED_POSTER_MIME_TYPES,
  MAX_POSTER_FILE_SIZE,
  MAX_POSTER_FILE_SIZE_LABEL,
  posterExtensionForMimeType,
} from "@/lib/poster-upload-constants";
import { getPaymentAdminClient } from "@/services/payment-order-service";

export const runtime = "nodejs";

const schema = z.object({
  order_id: z.string().min(10).max(80),
  upload_token: z.string().uuid().optional(),
  public_token: z.string().uuid().optional(),
  filename: z.string().trim().min(1).max(255),
  content_type: z.enum(ALLOWED_POSTER_MIME_TYPES),
  file_size: z.number().int().positive().max(MAX_POSTER_FILE_SIZE),
}).refine((value) => Boolean(value.upload_token || value.public_token), {
  message: "Sesi upload tidak valid",
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message = issue?.path.includes("file_size")
        ? `Ukuran setiap poster maksimal ${MAX_POSTER_FILE_SIZE_LABEL}`
        : issue?.path.includes("content_type")
          ? "Format poster harus JPG, PNG, atau WebP"
          : issue?.message || "Data upload poster tidak valid";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const supabase = getPaymentAdminClient();
    const { data: order, error } = await supabase
      .from("payment_orders")
      .select("order_id,status,upload_token,public_token")
      .eq("order_id", parsed.data.order_id)
      .maybeSingle();
    const tokenMatches = Boolean(order && (
      (parsed.data.upload_token && parsed.data.upload_token === order.upload_token)
      || (parsed.data.public_token && parsed.data.public_token === order.public_token)
    ));
    if (error) return NextResponse.json({ success: false, error: "Sesi pembayaran tidak dapat dibaca" }, { status: 503 });
    if (!order || !tokenMatches) return NextResponse.json({ success: false, error: "Sesi upload tidak ditemukan atau sudah tidak berlaku" }, { status: 404 });
    if (String(order.status || "").toUpperCase() !== "PAID") {
      return NextResponse.json({ success: false, error: "Poster hanya dapat diunggah setelah pembayaran lunas" }, { status: 409 });
    }

    const extension = posterExtensionForMimeType(parsed.data.content_type);
    const path = `payment-posters/${order.order_id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { data: signed, error: signedError } = await supabase.storage.from("posters").createSignedUploadUrl(path);
    if (signedError || !signed?.token) throw new Error(signedError?.message || "Izin upload tidak tersedia");
    const { data: publicData } = supabase.storage.from("posters").getPublicUrl(path);

    return NextResponse.json({
      success: true,
      data: {
        path,
        token: signed.token,
        public_url: publicData.publicUrl,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PosterSignedUpload]", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "Izin upload poster tidak dapat dibuat" }, { status: 500 });
  }
}
