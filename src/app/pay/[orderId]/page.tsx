import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import InvoiceClient from "./InvoiceClient";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function PayPage({ params }: PageProps) {
  const { orderId } = await params;

  // New payment invoices use an opaque token, never the sequential/order identifier.
  const { data: paymentOrder } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("public_token", orderId)
    .maybeSingle();

  if (paymentOrder) {
    const { data: invoice } = paymentOrder.related_invoice_id
      ? await supabase.from("invoices").select("*, invoice_items(*)").eq("id", paymentOrder.related_invoice_id).maybeSingle()
      : { data: null };
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6">
        <InvoiceClient order={{ ...paymentOrder, raw_items: invoice?.invoice_items || [], is_new_format: Boolean(invoice) }} />
      </main>
    );
  }

  // Compatibility for invoices manually created before payment tokens existed.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("invoice_number", orderId)
    .maybeSingle();
  if (!invoice) notFound();

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6">
      <InvoiceClient order={{
        order_id: invoice.invoice_number,
        status: invoice.status === "paid" ? "PAID" : "PENDING",
        created_at: invoice.invoice_date,
        customer_name: invoice.client_name,
        customer_whatsapp: invoice.client_phone,
        total_amount: invoice.total,
        subtotal: invoice.subtotal,
        discount_amount: invoice.discount_amount,
        discount_type: invoice.discount_type,
        discount_value: invoice.discount_value,
        tax_amount: invoice.tax_amount,
        tax_enabled: invoice.tax_enabled,
        tax_percent: invoice.tax_percent,
        sender_name: invoice.sender_name,
        notes: invoice.notes,
        bank_name: invoice.bank_name,
        bank_account_number: invoice.bank_account_number,
        bank_account_name: invoice.bank_account_name,
        is_new_format: true,
        raw_items: invoice.invoice_items || [],
      }} />
    </main>
  );
}
