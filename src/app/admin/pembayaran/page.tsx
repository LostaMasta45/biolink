"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
    CreditCard,
    DollarSign,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    RefreshCcw,
    ExternalLink,
    Phone,
    Building2,
    User,
    Filter,
    Package,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getTodayWIB } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { PaymentOrder, PaymentStatus } from "@/lib/payment-types";

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: React.ElementType }> = {
    PENDING: { label: "Menunggu", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock },
    PAID: { label: "Lunas", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
    EXPIRED: { label: "Expired", color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle },
    CANCELLED: { label: "Dibatalkan", color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: XCircle },
};

export default function AdminPembayaranPage() {
    const [orders, setOrders] = useState<PaymentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<PaymentStatus | "ALL">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        let query = supabase
            .from("payment_orders")
            .select("*")
            .order("created_at", { ascending: false });

        if (filterStatus !== "ALL") {
            query = query.eq("status", filterStatus);
        }

        const { data } = await query;
        setOrders((data as PaymentOrder[]) || []);
        setLoading(false);
    }, [filterStatus]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Stats
    const stats = {
        total: orders.length,
        paid: orders.filter(o => o.status === "PAID").length,
        pending: orders.filter(o => o.status === "PENDING").length,
        expired: orders.filter(o => o.status === "EXPIRED").length,
        revenue: orders
            .filter(o => o.status === "PAID")
            .reduce((sum, o) => sum + (o.total_amount || o.amount), 0),
        todayRevenue: orders
            .filter(o => {
                if (o.status !== "PAID") return false;
                const today = getTodayWIB();
                return o.paid_at?.startsWith(today) || o.created_at?.startsWith(today);
            })
            .reduce((sum, o) => sum + (o.total_amount || o.amount), 0),
    };

    // Filter by search
    const filteredOrders = orders.filter(o => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            o.order_id.toLowerCase().includes(q) ||
            o.customer_name.toLowerCase().includes(q) ||
            o.customer_company.toLowerCase().includes(q) ||
            o.customer_whatsapp.includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-primary" />
                        Pembayaran QRIS
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitoring semua pembayaran via QRIS
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchOrders}
                    className="shrink-0"
                >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Total Revenue</p>
                            <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                                Rp {stats.revenue.toLocaleString("id-ID")}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Hari Ini</p>
                            <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                                Rp {stats.todayRevenue.toLocaleString("id-ID")}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4 border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Pending</p>
                            <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                                {stats.pending}
                            </p>
                        </div>
                    </div>
                </Card>
                <Card className="p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Lunas</p>
                            <p className="text-lg font-extrabold text-foreground">
                                {stats.paid}
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter & Search */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari nama, perusahaan, order ID..."
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex gap-1.5 flex-wrap">
                        {(["ALL", "PENDING", "PAID", "EXPIRED"] as const).map((s) => (
                            <Button
                                key={s}
                                variant={filterStatus === s ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilterStatus(s)}
                                className="rounded-lg text-xs"
                            >
                                {s === "ALL" ? "Semua" : STATUS_CONFIG[s].label}
                            </Button>
                        ))}
                    </div>
                </div>
            </Card>

            {/* Orders List */}
            <div className="space-y-3">
                {loading ? (
                    <Card className="p-12 text-center">
                        <RefreshCcw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Memuat data...</p>
                    </Card>
                ) : filteredOrders.length === 0 ? (
                    <Card className="p-12 text-center">
                        <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="font-semibold text-foreground">Belum ada pembayaran</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Pembayaran QRIS akan muncul di sini
                        </p>
                    </Card>
                ) : (
                    filteredOrders.map((order, idx) => {
                        const statusConfig = STATUS_CONFIG[order.status];
                        const StatusIcon = statusConfig.icon;

                        return (
                            <motion.div
                                key={order.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <Card
                                    className={cn(
                                        "p-4 cursor-pointer hover:shadow-md transition-all",
                                        selectedOrder?.id === order.id && "ring-2 ring-primary"
                                    )}
                                    onClick={() => setSelectedOrder(
                                        selectedOrder?.id === order.id ? null : order
                                    )}
                                >
                                    {/* Main Row */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {order.order_id}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[10px] font-bold", statusConfig.color)}
                                                >
                                                    <StatusIcon className="w-3 h-3 mr-1" />
                                                    {statusConfig.label}
                                                </Badge>
                                            </div>
                                            <p className="font-bold text-foreground text-sm truncate">
                                                {order.customer_company}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {order.customer_name}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Package className="w-3 h-3" />
                                                    {order.package_name}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "text-lg font-extrabold",
                                                order.status === "PAID"
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-foreground"
                                            )}>
                                                Rp {(order.total_amount || order.amount).toLocaleString("id-ID")}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {new Date(order.created_at).toLocaleDateString("id-ID", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {selectedOrder?.id === order.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            className="mt-4 pt-4 border-t border-border space-y-3"
                                        >
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">WhatsApp</p>
                                                    <a
                                                        href={`https://wa.me/${order.customer_whatsapp.replace(/^0/, "62")}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary font-semibold flex items-center gap-1 hover:underline"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        {order.customer_whatsapp}
                                                    </a>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-0.5">Perusahaan</p>
                                                    <p className="font-semibold flex items-center gap-1">
                                                        <Building2 className="w-3 h-3" />
                                                        {order.customer_company}
                                                    </p>
                                                </div>
                                            </div>

                                            {order.addon_names && order.addon_names.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-muted-foreground mb-1">Add-on</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {order.addon_names.map((name, i) => (
                                                            <Badge key={i} variant="secondary" className="text-[10px]">
                                                                {name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2 flex-wrap">
                                                {order.synced_to_finance && (
                                                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20 bg-emerald-500/5">
                                                        ✅ Sync Keuangan
                                                    </Badge>
                                                )}
                                                {order.synced_to_posting && (
                                                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-500/20 bg-blue-500/5">
                                                        ✅ Sync Antrian
                                                    </Badge>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </Card>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
