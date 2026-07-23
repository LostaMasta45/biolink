import { NextResponse } from "next/server";
import type { KlikQRISWebhookPayload } from "@/lib/payment-types";
import { confirmPaidPayment, getPaymentAdminClient, markPaymentExpired } from "@/services/payment-order-service";
import { reportTelegramPaymentExpired, reportTelegramPaymentPaid } from "@/services/telegram-admin-service";
import { emitPaymentPaidNotifications } from "@/services/whatsapp-notification-service";
import { writeActivityLog } from "@/services/whatsapp-audit-service";

export async function POST(request: Request) {
  let orderId: string | null = null;
  try {
    const body = await request.json() as KlikQRISWebhookPayload;
    const data = body?.data;
    if (!data?.order_id) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    orderId = data.order_id;

    const supabase = getPaymentAdminClient();
    const { data: order, error } = await supabase.from("payment_orders").select("*").eq("order_id", orderId).maybeSingle();
    if (error || !order) {
      await writeActivityLog({ customer: `payment:${orderId}`, eventType: "payment.webhook.order_not_found", status: "failed", message: "Order pembayaran tidak ditemukan" });
      return NextResponse.json({ message: "Order not found" }, { status: 200 });
    }
    // KlikQRIS signature issued at creation remains a secondary validation. Add their
    // documented request-signature/HMAC verification here when the provider exposes it.
    if (order.signature && data.signature && order.signature !== data.signature) {
      await writeActivityLog({ customer: order.customer_whatsapp, eventType: "payment.webhook.invalid_signature", status: "failed", message: "Signature webhook pembayaran tidak cocok", metadata: { order_id: orderId } });
      return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
    }

    const providerStatus = String(data.status || "").toUpperCase();
    const eventKey = `webhook:${data.signature || data.payment_date || providerStatus}`;
    if (providerStatus === "PAID" || providerStatus === "SUCCESS") {
      const result = await confirmPaidPayment({
        orderId,
        paidAt: data.payment_date,
        amountPaid: Number(data.amount_paid || 0) || undefined,
        providerStatus,
        eventKey,
        payload: body,
      });
      const isPaid = result.order.status === "PAID";
      const amount = Number(result.order.payable_amount || result.order.total_amount || result.order.amount);
      await writeActivityLog({
        customer: result.order.customer_whatsapp,
        eventType: isPaid ? "payment.paid" : "payment.paid_rejected",
        status: isPaid ? "success" : "skipped",
        message: isPaid ? `Pembayaran ${orderId} berhasil dikonfirmasi` : `Konfirmasi pembayaran ${orderId} tidak mengubah status menjadi lunas`,
        metadata: { order_id: orderId, amount, provider_status: providerStatus, first_confirmation: result.confirmed, final_status: result.order.status },
      });

      // Idempotent dedupe allows reconciliation webhooks to heal an earlier failed
      // downstream sync without sending a second WhatsApp notification.
      await Promise.all([
        isPaid ? emitPaymentPaidNotifications(result.order) : Promise.resolve(),
        isPaid
          ? reportTelegramPaymentPaid({
            order: result.order,
            processed: result.processed,
            processingError: result.processingError,
          })
          : Promise.resolve(),
      ]);
    } else if (providerStatus === "EXPIRED") {
      const expiredOrder = await markPaymentExpired(orderId, eventKey, body);
      await writeActivityLog({ customer: order.customer_whatsapp, eventType: "payment.expired", status: "success", message: `Pembayaran ${orderId} expired`, metadata: { order_id: orderId } });
      await reportTelegramPaymentExpired(expiredOrder || order);
    }
    return NextResponse.json({ message: "OK" });
  } catch (error) {
    console.error("[PaymentWebhook]", error);
    await writeActivityLog({ customer: orderId ? `payment:${orderId}` : "payment:webhook", eventType: "payment.webhook.failed", status: "failed", message: error instanceof Error ? error.message : "Webhook pembayaran gagal diproses" });
    // The event is retained by the provider as acknowledged; reconciliation will retry
    // the idempotent downstream work from the status endpoint/job.
    return NextResponse.json({ message: "Error handled" });
  }
}
