import { NextResponse } from "next/server";
import { getPaymentAdminClient } from "@/services/payment-order-service";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const orderId = String(form.get("order_id") || "");
    const uploadToken = String(form.get("upload_token") || "");
    const file = form.get("file");
    if (!orderId || !uploadToken || !(file instanceof File)) return NextResponse.json({ success: false, error: "Data unggah poster tidak lengkap" }, { status: 400 });
    if (!file.type.startsWith("image/") || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Poster harus berupa gambar maksimal 10 MB" }, { status: 400 });
    }

    const supabase = getPaymentAdminClient();
    const { data: order, error: orderError } = await supabase.from("payment_orders").select("order_id,status,upload_token").eq("order_id", orderId).maybeSingle();
    if (orderError || !order || order.status !== "PAID" || uploadToken !== order.upload_token) {
      return NextResponse.json({ success: false, error: "Sesi unggah poster tidak valid" }, { status: 403 });
    }

    const path = `payment-posters/${orderId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error: uploadError } = await supabase.storage.from("posters").upload(path, file, { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("posters").getPublicUrl(path);
    return NextResponse.json({ success: true, data: { url: data.publicUrl } });
  } catch (error) {
    console.error("[PosterFileUpload]", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "File poster tidak dapat diunggah" }, { status: 500 });
  }
}
