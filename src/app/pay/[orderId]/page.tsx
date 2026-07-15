import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import InvoiceClient from "./InvoiceClient";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageProps {
    params: {
        orderId: string;
    };
}

export default async function PayPage({ params }: PageProps) {
    // Next.js 15+ route params are often asynchronous, but standard `params.orderId` still works in standard server components if correctly typed.
    // To be safe against strict mode warnings:
    const { orderId } = await params;

    let orderData = null;

    // 1. Coba cari di tabel invoices yang baru (mendukung edit dari dashboard admin)
    const { data: invData } = await supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .eq("invoice_number", orderId)
        .single();

    if (invData) {
        orderData = {
            order_id: invData.invoice_number,
            status: invData.status === "paid" ? "PAID" : "PENDING",
            created_at: invData.invoice_date,
            customer_name: invData.client_name,
            customer_whatsapp: invData.client_phone,
            total_amount: invData.total,
            subtotal: invData.subtotal,
            discount_amount: invData.discount_amount,
            discount_type: invData.discount_type,
            discount_value: invData.discount_value,
            tax_amount: invData.tax_amount,
            tax_enabled: invData.tax_enabled,
            tax_percent: invData.tax_percent,
            sender_name: invData.sender_name,
            notes: invData.notes,
            bank_name: invData.bank_name,
            bank_account_number: invData.bank_account_number,
            bank_account_name: invData.bank_account_name,
            is_new_format: true,
            raw_items: invData.invoice_items || []
        };
    } else {
        // 2. Fallback ke tabel payment_orders (untuk invoice lama sebelum migrasi)
        const { data: payData } = await supabase
            .from("payment_orders")
            .select("*")
            .eq("order_id", orderId)
            .single();
            
        orderData = payData;
    }

    if (!orderData) {
        return notFound();
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6">
            <InvoiceClient order={orderData} />
        </main>
    );
}
