import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const getSupabase = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
};

export interface PaymentOrder {
    id: number;
    order_id: string;
    customer_name: string;
    customer_whatsapp: string;
    customer_company: string;
    package_id: number;
    package_name: string;
    addons: number[];
    addon_names: string[];
    amount: number;
    total_amount: number;
    qris_url: string;
    qris_image: string;
    direct_url: string;
    status: "PENDING" | "PAID" | "EXPIRED";
    expired_at: string;
    keterangan: string;
    created_at: string;
    updated_at: string;
}

export async function getQRISInvoices() {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from("payment_orders")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching QRIS invoices:", error);
        return [];
    }

    return (data as PaymentOrder[]) || [];
}

export async function getQRISSummary() {
    const invoices = await getQRISInvoices();
    
    let totalRevenue = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let expiredCount = 0;

    for (const inv of invoices) {
        if (inv.status === "PAID") {
            totalRevenue += inv.total_amount;
            paidCount++;
        } else if (inv.status === "PENDING") {
            pendingCount++;
        } else if (inv.status === "EXPIRED") {
            expiredCount++;
        }
    }

    return {
        totalRevenue,
        pendingCount,
        paidCount,
        expiredCount,
        totalCount: invoices.length,
    };
}
