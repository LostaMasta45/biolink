import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
    PAYMENT_PACKAGES,
    PAYMENT_ADDONS,
    type CreatePaymentRequest,
    type KlikQRISCreateResponse,
} from "@/lib/payment-types";

// Server-side Supabase client (no cookies needed for public endpoint)
function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function POST(request: Request) {
    try {
        const body: CreatePaymentRequest = await request.json();
        const { customer_name, customer_whatsapp, customer_company, package_id, addons } = body;

        // Validate required fields
        if (!customer_name || !customer_whatsapp || !customer_company || !package_id) {
            return NextResponse.json(
                { success: false, error: "Semua field wajib diisi" },
                { status: 400 }
            );
        }

        // Find package
        const selectedPackage = PAYMENT_PACKAGES.find(p => p.id === package_id);
        if (!selectedPackage) {
            return NextResponse.json(
                { success: false, error: "Paket tidak ditemukan" },
                { status: 400 }
            );
        }

        // Calculate total
        const selectedAddons = PAYMENT_ADDONS.filter(a => addons?.includes(a.id));
        const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price, 0);
        const totalAmount = selectedPackage.price + addonsTotal;

        // Generate unique order ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const orderId = `ILJ-${timestamp}-${random}`;

        // Build keterangan
        const addonNames = selectedAddons.map(a => a.name);
        const keterangan = `${selectedPackage.name}${addonNames.length > 0 ? ' + ' + addonNames.join(', ') : ''} - ${customer_company}`;

        // Call KlikQRIS API (MY PG v2)
        const klikqrisResponse = await fetch(`${process.env.KLIKQRIS_API_URL}/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.KLIKQRIS_API_KEY!,
                "id_merchant": process.env.KLIKQRIS_MERCHANT_ID!,
            },
            body: JSON.stringify({
                order_id: orderId,
                id_merchant: process.env.KLIKQRIS_MERCHANT_ID!,
                amount: totalAmount,
                keterangan: keterangan,
            }),
        });

        const klikqrisData: KlikQRISCreateResponse = await klikqrisResponse.json();

        if (!klikqrisData.status) {
            console.error("KlikQRIS Error:", klikqrisData);
            return NextResponse.json(
                { success: false, error: klikqrisData.message || "Gagal membuat QRIS" },
                { status: 500 }
            );
        }

        // Save to Supabase
        const supabase = getSupabase();
        const { error: dbError } = await supabase.from("payment_orders").insert({
            order_id: orderId,
            customer_name,
            customer_whatsapp,
            customer_company,
            package_id,
            package_name: selectedPackage.name,
            addons: addons || [],
            addon_names: addonNames,
            amount: totalAmount,
            total_amount: Math.ceil(parseFloat(klikqrisData.data.total_amount)),
            qris_url: klikqrisData.data.qris_url || null,
            qris_image: klikqrisData.data.qris_image || null,
            direct_url: klikqrisData.data.direct_url || null,
            signature: klikqrisData.data.signature,
            status: "PENDING",
            expired_at: klikqrisData.data.expired_at,
            keterangan,
        });

        if (dbError) {
            console.error("Supabase Error:", dbError);
            return NextResponse.json(
                { success: false, error: "Gagal menyimpan data pembayaran" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                order_id: orderId,
                amount: totalAmount,
                total_amount: Math.ceil(parseFloat(klikqrisData.data.total_amount)),
                qris_url: klikqrisData.data.qris_url || null,
                qris_image: klikqrisData.data.qris_image || null,
                direct_url: klikqrisData.data.direct_url || null,
                signature: klikqrisData.data.signature,
                expired_at: klikqrisData.data.expired_at,
                package_name: selectedPackage.name,
                addon_names: addonNames,
            },
        });
    } catch (error) {
        console.error("Payment Create Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
