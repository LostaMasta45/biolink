"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, Wallet, CheckCircle2, Clock, XCircle, Search, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getQRISInvoices, getQRISSummary, type PaymentOrder } from "@/lib/qris-service";
import { formatRupiah, formatDate } from "@/lib/utils";

export default function AdminQRISPage() {
    const [invoices, setInvoices] = useState<PaymentOrder[]>([]);
    const [filteredInvoices, setFilteredInvoices] = useState<PaymentOrder[]>([]);
    const [summary, setSummary] = useState({ totalRevenue: 0, pendingCount: 0, paidCount: 0, expiredCount: 0, totalCount: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [data, sum] = await Promise.all([
                getQRISInvoices(),
                getQRISSummary()
            ]);
            setInvoices(data);
            setFilteredInvoices(data);
            setSummary(sum);
        } catch (error) {
            console.error("Failed to load QRIS data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const query = searchQuery.toLowerCase();
        const filtered = invoices.filter(inv => 
            inv.order_id.toLowerCase().includes(query) || 
            inv.customer_name.toLowerCase().includes(query) ||
            inv.customer_company.toLowerCase().includes(query)
        );
        setFilteredInvoices(filtered);
    }, [searchQuery, invoices]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "PAID":
                return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Lunas</Badge>;
            case "PENDING":
                return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case "EXPIRED":
                return <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20"><XCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6 pb-20 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">QRIS Transaksi</h1>
                    <p className="text-muted-foreground">Monitoring pembayaran otomatis via QRIS KlikQRIS</p>
                </div>
                <Button onClick={loadData} variant="outline" disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                    Refresh Data
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-emerald-600 border-none shadow-md relative overflow-hidden group text-white">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <Wallet className="h-24 w-24 text-white" />
                    </div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="font-semibold text-sm text-emerald-50 leading-snug pr-2">Total Pendapatan (Paid)</CardTitle>
                        <div className="p-2 bg-white/20 rounded-full shrink-0">
                            <Wallet className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-2xl lg:text-3xl font-bold tracking-tight">{formatRupiah(summary.totalRevenue)}</div>
                        <p className="text-xs font-medium text-emerald-100 mt-2 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> 
                            <span>Dari {summary.paidCount} transaksi berhasil</span>
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-amber-500 border-none shadow-md relative overflow-hidden group text-white">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <Clock className="h-24 w-24 text-white" />
                    </div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="font-semibold text-sm text-amber-50 leading-snug pr-2">Menunggu Pembayaran</CardTitle>
                        <div className="p-2 bg-white/20 rounded-full shrink-0">
                            <Clock className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-2xl lg:text-3xl font-bold tracking-tight">{summary.pendingCount}</div>
                        <p className="text-xs font-medium text-amber-100 mt-2">
                            Transaksi pending (belum bayar)
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-red-500 border-none shadow-md relative overflow-hidden group text-white">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <XCircle className="h-24 w-24 text-white" />
                    </div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="font-semibold text-sm text-red-50 leading-snug pr-2">Transaksi Gagal</CardTitle>
                        <div className="p-2 bg-white/20 rounded-full shrink-0">
                            <XCircle className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-2xl lg:text-3xl font-bold tracking-tight">{summary.expiredCount}</div>
                        <p className="text-xs font-medium text-red-100 mt-2">
                            Transaksi kedaluwarsa
                        </p>
                    </CardContent>
                </Card>
                
                <Card className="bg-blue-600 border-none shadow-md relative overflow-hidden group text-white">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                        <Hash className="h-24 w-24 text-white" />
                    </div>
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="font-semibold text-sm text-blue-50 leading-snug pr-2">Total Transaksi</CardTitle>
                        <div className="p-2 bg-white/20 rounded-full shrink-0">
                            <Hash className="h-4 w-4 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-2xl lg:text-3xl font-bold tracking-tight">{summary.totalCount}</div>
                        <p className="text-xs font-medium text-blue-100 mt-2">
                            Total invoice QRIS yang digenerate
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Data Table */}
            <Card className="shadow-sm border-border/50">
                <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <CardTitle>Riwayat Transaksi QRIS</CardTitle>
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Cari nama, perusahaan, order ID..."
                                className="pl-9 bg-background"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-border/50 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[120px]">Order ID</TableHead>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Paket</TableHead>
                                    <TableHead className="text-right">Nominal</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                                            <p className="mt-2 text-sm text-muted-foreground">Memuat data...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <p className="text-sm text-muted-foreground">Tidak ada transaksi ditemukan.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInvoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell className="font-mono text-xs font-medium">{inv.order_id}</TableCell>
                                            <TableCell className="text-sm">{formatDate(inv.created_at)}</TableCell>
                                            <TableCell>
                                                <div className="font-semibold text-sm">{inv.customer_name}</div>
                                                <div className="text-xs text-muted-foreground">{inv.customer_company}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium">{inv.package_name}</div>
                                                {inv.addon_names && inv.addon_names.length > 0 && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                                        + {inv.addon_names.join(", ")}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">
                                                {formatRupiah(inv.total_amount)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {getStatusBadge(inv.status)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
