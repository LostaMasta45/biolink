import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const { orderId } = await params;
        const supabase = getSupabase();

        // First check from local DB
        const { data: order, error } = await supabase
            .from("payment_orders")
            .select("order_id, status, total_amount, paid_at, expired_at")
            .eq("order_id", orderId)
            .single();

        if (error || !order) {
            return NextResponse.json(
                { success: false, error: "Order tidak ditemukan" },
                { status: 404 }
            );
        }

        // If already PAID or EXPIRED, return immediately
        if (order.status === "PAID" || order.status === "EXPIRED") {
            return NextResponse.json({
                success: true,
                data: {
                    order_id: order.order_id,
                    status: order.status,
                    total_amount: order.total_amount,
                    paid_at: order.paid_at,
                    expired_at: order.expired_at,
                },
            });
        }

        // If still PENDING, also check KlikQRIS API for realtime status
        try {
            const merchantId = process.env.KLIKQRIS_MERCHANT_ID!;
            const statusUrl = `${process.env.KLIKQRIS_API_URL}/status/${merchantId}/${orderId}`;

            const klikqrisRes = await fetch(statusUrl, {
                method: "GET",
                headers: {
                    "x-api-key": process.env.KLIKQRIS_API_KEY!,
                    "id_merchant": merchantId,
                },
                // Don't cache status checks
                cache: "no-store",
            });

            const klikqrisData = await klikqrisRes.json();

            if (klikqrisData.status && klikqrisData.data) {
                const apiStatus = klikqrisData.data.status;

                // If status changed, update local DB
                if (apiStatus !== order.status) {
                    const updateData: Record<string, unknown> = {
                        status: apiStatus === "SUCCESS" ? "PAID" : apiStatus,
                        updated_at: new Date().toISOString(),
                    };

                    if (apiStatus === "SUCCESS" || apiStatus === "PAID") {
                        updateData.status = "PAID";
                        updateData.paid_at = klikqrisData.data.paid_at || new Date().toISOString();
                    }

                    await supabase
                        .from("payment_orders")
                        .update(updateData)
                        .eq("order_id", orderId);

                    return NextResponse.json({
                        success: true,
                        data: {
                            order_id: orderId,
                            status: updateData.status as string,
                            total_amount: order.total_amount,
                            paid_at: (updateData.paid_at as string) || null,
                            expired_at: order.expired_at,
                        },
                    });
                }
            }
        } catch (apiError) {
            console.error("KlikQRIS status check failed:", apiError);
            // Fall through to return local DB status
        }

        return NextResponse.json({
            success: true,
            data: {
                order_id: order.order_id,
                status: order.status,
                total_amount: order.total_amount,
                paid_at: order.paid_at,
                expired_at: order.expired_at,
            },
        });
    } catch (error) {
        console.error("Payment Status Error:", error);
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
