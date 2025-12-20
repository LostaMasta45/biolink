"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Plus,
    TrendingUp,
    TrendingDown,
    Wallet,
    Calendar,
    Filter,
    Download,
    MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import type { Transaction, TransactionCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mock data
const mockTransactions: Transaction[] = [
    {
        id: "1",
        type: "income",
        amount: 75000,
        category: "posting",
        description: "Posting loker",
        client: "PT Maju Jaya",
        date: "2024-12-19",
        status: "paid",
        payment_method: "transfer",
        created_at: new Date().toISOString(),
    },
    {
        id: "2",
        type: "income",
        amount: 50000,
        category: "posting",
        description: "Posting loker",
        client: "CV Berkah Sejahtera",
        date: "2024-12-18",
        status: "pending",
        created_at: new Date().toISOString(),
    },
    {
        id: "3",
        type: "income",
        amount: 100000,
        category: "promo",
        description: "Paket promo 1 minggu",
        client: "PT XYZ Indonesia",
        date: "2024-12-17",
        status: "paid",
        payment_method: "ewallet",
        created_at: new Date().toISOString(),
    },
    {
        id: "4",
        type: "income",
        amount: 25000,
        category: "boost",
        description: "Boost post",
        client: "Toko Makmur",
        date: "2024-12-16",
        status: "paid",
        payment_method: "cash",
        created_at: new Date().toISOString(),
    },
];

const mockMonthlyData = [
    { month: "Jul", income: 450000 },
    { month: "Aug", income: 620000 },
    { month: "Sep", income: 580000 },
    { month: "Oct", income: 750000 },
    { month: "Nov", income: 890000 },
    { month: "Dec", income: 850000 },
];

export default function KeuanganPage() {
    const [transactions] = useState<Transaction[]>(mockTransactions);
    const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">(
        "all"
    );

    const totalIncome = transactions
        .filter((t) => t.type === "income" && t.status === "paid")
        .reduce((sum, t) => sum + t.amount, 0);

    const monthlyIncome = transactions
        .filter(
            (t) =>
                t.type === "income" &&
                t.status === "paid" &&
                new Date(t.date).getMonth() === new Date().getMonth()
        )
        .reduce((sum, t) => sum + t.amount, 0);

    const pendingAmount = transactions
        .filter((t) => t.status === "pending")
        .reduce((sum, t) => sum + t.amount, 0);

    const filteredTransactions = transactions.filter((t) => {
        if (filterStatus === "all") return true;
        return t.status === filterStatus;
    });

    const maxIncome = Math.max(...mockMonthlyData.map((d) => d.income));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Keuangan</h1>
                    <p className="text-muted-foreground">
                        Laporan pemasukan dan arus kas
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="flex-1 sm:flex-none">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="flex-1 sm:flex-none">
                                <Plus className="mr-2 h-4 w-4" /> Catat Transaksi
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Catat Transaksi Baru</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Jenis</Label>
                                    <Select defaultValue="income">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="income">Pemasukan</SelectItem>
                                            <SelectItem value="expense">Pengeluaran</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Jumlah (Rp)</Label>
                                    <Input type="number" placeholder="0" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Keterangan</Label>
                                    <Input placeholder="Contoh: Posting Loker PT A" />
                                </div>
                                <Button className="w-full">Simpan</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatRupiah(totalIncome)}</div>
                        <p className="text-xs text-emerald-500 flex items-center mt-1">
                            <TrendingUp className="mr-1 h-3 w-3" /> +18% dari bulan lalu
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bulan Ini</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatRupiah(monthlyIncome)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Desember 2024</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Belum Dibayar</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatRupiah(pendingAmount)}</div>
                        <p className="text-xs text-amber-500 mt-1">
                            {transactions.filter((t) => t.status === "pending").length} transaksi pending
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                {/* Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Pendapatan 6 Bulan Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-end justify-between gap-2 px-4">
                            {mockMonthlyData.map((data, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div
                                        className="w-full bg-primary/20 group-hover:bg-primary/40 transition-all rounded-t-md relative"
                                        style={{ height: `${(data.income / maxIncome) * 100}%` }}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs p-1 rounded shadow pointer-events-none whitespace-nowrap">
                                            {formatRupiah(data.income)}
                                        </div>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{data.month}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Transactions */}
                <Card className="col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Transaksi Terbaru</CardTitle>
                        <Select
                            defaultValue="all"
                            onValueChange={(val) => setFilterStatus(val as any)}
                        >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                <SelectItem value="paid">Lunas</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableBody>
                                    {filteredTransactions.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="py-3">
                                                <div className="font-medium">{t.client}</div>
                                                <div className="text-xs text-muted-foreground">{t.description}</div>
                                            </TableCell>
                                            <TableCell className="text-right py-3">
                                                <div className={`font-medium ${t.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                    {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
                                                </div>
                                                <Badge variant={t.status === 'paid' ? 'secondary' : 'warning'} className="text-[10px] h-5 px-1.5 mt-1">
                                                    {t.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
