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

    const { data: order } = await supabase
        .from("payment_orders")
        .select("*")
        .eq("order_id", orderId)
        .single();

    if (!order) {
        return notFound();
    }

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 sm:px-6">
            <InvoiceClient order={order} />
        </main>
    );
}
