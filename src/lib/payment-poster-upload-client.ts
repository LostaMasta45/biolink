import { createBrowserClient } from "@supabase/ssr";

interface PaymentPosterSession {
  orderId: string;
  uploadToken?: string;
  publicToken?: string;
}

interface SignedUploadResponse {
  success?: boolean;
  error?: string;
  data?: {
    path?: string;
    token?: string;
    public_url?: string;
  };
}

export async function uploadPaymentPoster(
  file: File,
  session: PaymentPosterSession,
  onProgress?: (percentage: number) => void,
): Promise<string> {
  const signResponse = await fetch("/api/payment/poster-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_id: session.orderId,
      upload_token: session.uploadToken,
      public_token: session.publicToken,
      filename: file.name,
      content_type: file.type,
      file_size: file.size,
    }),
  });
  const signed = await signResponse.json() as SignedUploadResponse;
  const path = signed.data?.path;
  const token = signed.data?.token;
  const publicUrl = signed.data?.public_url;
  if (!signResponse.ok || !signed.success || !path || !token || !publicUrl) {
    throw new Error(signed.error || "Izin upload poster tidak dapat dibuat");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Konfigurasi upload belum lengkap");
  onProgress?.(10);
  const supabase = createBrowserClient(supabaseUrl, anonKey);
  const { error: uploadError } = await supabase.storage.from("posters").uploadToSignedUrl(
    path,
    token,
    file,
    { cacheControl: "3600", contentType: file.type },
  );
  if (uploadError) throw new Error(uploadError.message || "Upload poster terputus");
  onProgress?.(100);

  return publicUrl;
}
