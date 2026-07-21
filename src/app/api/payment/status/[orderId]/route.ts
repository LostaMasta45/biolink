import { NextResponse } from "next/server";
import { asPaymentResponse, confirmPaidPayment, getPaymentAdminClient, markPaymentExpired } from "@/services/payment-order-service";

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    const token = new URL(request.url).searchParams.get("token");
    const supabase = getPaymentAdminClient();
    const { data: order, error } = await supabase.from("payment_orders").select("*").eq("order_id", orderId).maybeSingle();
    if (error || !order || !token || token !== order.public_token) {
      return NextResponse.json({ success: false, error: "Order tidak ditemukan" }, { status: 404 });
    }

    if (order.status === "PAID") {
      // Re-run idempotent sync so a prior temporary downstream failure heals itself.
      await confirmPaidPayment({ orderId, eventKey: "status:paid-reconcile", providerStatus: "PAID" });
      return NextResponse.json({ success: true, data: { ...asPaymentResponse(order), status: "PAID", paid_at: order.paid_at } });
    }
    if (order.status === "EXPIRED" || order.status === "CANCELLED") {
      return NextResponse.json({ success: true, data: { ...asPaymentResponse(order), status: order.status, paid_at: order.paid_at } });
    }

    try {
      const merchantId = process.env.KLIKQRIS_MERCHANT_ID!;
      const response = await fetch(`${process.env.KLIKQRIS_API_URL}/status/${merchantId}/${orderId}`, {
        headers: { "x-api-key": process.env.KLIKQRIS_API_KEY!, id_merchant: merchantId },
        cache: "no-store",
      });
      const provider = await response.json();
      const providerStatus = String(provider?.data?.status || "").toUpperCase();
      if (providerStatus === "SUCCESS" || providerStatus === "PAID") {
        const result = await confirmPaidPayment({
          orderId,
          paidAt: provider.data.paid_at,
          amountPaid: Number(provider.data.amount_paid || provider.data.total_amount || 0) || undefined,
          providerStatus,
          eventKey: `status:${provider.data.payment_date || provider.data.paid_at || "paid"}`,
          payload: provider,
        });
        return NextResponse.json({ success: true, data: { ...asPaymentResponse(result.order), status: "PAID", paid_at: result.order.paid_at } });
      }
      if (providerStatus === "EXPIRED") await markPaymentExpired(orderId, `status:expired:${order.updated_at}`, provider);
    } catch (providerError) {
      console.error("[PaymentStatus] provider check failed", providerError);
    }

    const { data: latest } = await supabase.from("payment_orders").select("*").eq("order_id", orderId).single();
    return NextResponse.json({ success: true, data: { ...asPaymentResponse(latest || order), status: latest?.status || order.status, paid_at: latest?.paid_at || order.paid_at } });
  } catch (error) {
    console.error("[PaymentStatus]", error);
    return NextResponse.json({ success: false, error: "Status pembayaran tidak dapat diperiksa" }, { status: 500 });
  }
}
