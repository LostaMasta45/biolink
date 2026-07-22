import { NextResponse } from "next/server";
import { asPaymentResponse, getPaymentAdminClient } from "@/services/payment-order-service";

/**
 * Resume a customer payment session from the public QRIS token. The token is
 * already the bearer credential used by the public QRIS link; return only the
 * order fields required to continue the poster step.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ publicToken: string }> }) {
  try {
    const { publicToken } = await params;
    const supabase = getPaymentAdminClient();
    const { data: order, error } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("public_token", publicToken)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ success: false, error: "Sesi pembayaran tidak ditemukan" }, { status: 404 });
    }

    const response = asPaymentResponse(order);
    if (String(order.status || "").toUpperCase() !== "PAID") response.upload_token = undefined;
    return NextResponse.json({ success: true, data: response }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PaymentResume]", error);
    return NextResponse.json({ success: false, error: "Sesi pembayaran tidak dapat dipulihkan" }, { status: 500 });
  }
}
