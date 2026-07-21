import { NextResponse } from "next/server";
import { createPaymentSchema } from "@/lib/payment-order";
import { createPaymentOrder } from "@/services/payment-order-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message || "Data pembayaran tidak valid" }, { status: 400 });
    }

    const data = await createPaymentOrder(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pembayaran tidak dapat dibuat";
    console.error("[PaymentCreate]", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
