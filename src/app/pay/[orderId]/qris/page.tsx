import { createClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import QrisPaymentClient from "./QrisPaymentClient";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

interface PageProps { params: Promise<{ orderId: string }>; }

/** Public, token-protected QRIS landing page used by customer WhatsApp links. */
export default async function PublicQrisPage({ params }: PageProps) {
  const { orderId: publicToken } = await params;
  const { data: order } = await supabase
    .from("payment_orders")
    .select("order_id,public_token,status,payable_amount,total_amount,qris_image,qris_url,expired_at,package_name,poster_status")
    .eq("public_token", publicToken)
    .maybeSingle();

  if (!order || !order.public_token || !order.qris_image && !order.qris_url) notFound();
  if (String(order.status).toUpperCase() === "PAID" && ["uploaded", "deferred"].includes(String(order.poster_status || "pending").toLowerCase())) {
    redirect(`/payment/thankyou?order=${encodeURIComponent(order.order_id)}`);
  }
  if (String(order.status).toUpperCase() === "PAID") {
    redirect(`/payment?resume=${encodeURIComponent(order.public_token)}`);
  }

  return (
    <QrisPaymentClient
      orderId={order.order_id}
      accessToken={order.public_token}
      totalAmount={Number(order.payable_amount || order.total_amount || 0)}
      qrisImage={order.qris_image ?? null}
      qrisUrl={order.qris_url ?? null}
      expiredAt={order.expired_at}
      packageName={order.package_name || "Pembayaran InfoLokerJombang"}
    />
  );
}
