"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    FileText,
    ListTodo,
    Wallet,
    Clock,
    CheckCircle2,
    ArrowUpRight,
    Calendar,
    CalendarCheck,
    Package,
    RefreshCw,
    ArrowRight,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Users,
    Zap,
    MoreVertical,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatRupiah } from "@/lib/utils";
import { getPostings, getPackages } from "@/lib/posting-service";
import type { QueuePost, PostingPackage } from "@/lib/types";
import toast from "react-hot-toast";

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

export default function AdminDashboard() {
    const [posts, setPosts] = useState<QueuePost[]>([]);
    const [packages, setPackages] = useState<PostingPackage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [postsRes, packagesRes] = await Promise.all([
                getPostings(),
                getPackages(),
            ]);
            if (postsRes.data) setPosts(postsRes.data);
            if (packagesRes.data) setPackages(packagesRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    // #11 - Dynamic Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 5) return "Selamat Malam";
        if (hour < 11) return "Selamat Pagi";
        if (hour < 15) return "Selamat Siang";
        if (hour < 18) return "Selamat Sore";
        return "Selamat Malam";
    }, []);

    // Date helpers
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Computed Stats
    const todayRevenue = posts
        .filter(p => p.scheduled_date === today)
        .reduce((sum, p) => sum + p.total_price, 0);

    const totalCompleted = posts.filter(p => p.status === "posted").length;

    const thisMonthPosts = posts.filter(p => {
        const d = new Date(p.scheduled_date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const thisMonthRevenue = thisMonthPosts.reduce((sum, p) => sum + p.total_price, 0);

    const lastMonthPosts = posts.filter(p => {
        const d = new Date(p.scheduled_date);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const lastMonthRevenue = lastMonthPosts.reduce((sum, p) => sum + p.total_price, 0);
    const revenueChange = lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : thisMonthRevenue > 0 ? 100 : 0;

    // Mini Chart Data
    const last7DaysRevenue = useMemo(() => {
        const result: { date: string; revenue: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            const dayRevenue = posts
                .filter(p => p.scheduled_date === dateStr)
                .reduce((sum, p) => sum + p.total_price, 0);
            result.push({ date: dateStr, revenue: dayRevenue });
        }
        return result;
    }, [posts]);
    const maxRevenue = Math.max(...last7DaysRevenue.map(d => d.revenue), 1);

    const overduePosts = posts.filter(p =>
        p.scheduled_date < today &&
        (p.status === "draft" || p.status === "queued")
    );

    const repeatClients = useMemo(() => {
        const clientCount: Record<string, number> = {};
        posts.forEach(p => {
            clientCount[p.company_name] = (clientCount[p.company_name] || 0) + 1;
        });
        return Object.entries(clientCount)
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    }, [posts]);

    const todaySchedule = posts
        .filter(p => p.scheduled_date === today)
        .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time));

    // Calendar Data
    const calendarDates = useMemo(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();

        const dates: { date: Date; hasPost: boolean; count: number }[] = [];
        for (let i = 0; i < startPadding; i++) {
            const d = new Date(year, month, -startPadding + i + 1);
            dates.push({ date: d, hasPost: false, count: 0 });
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const d = new Date(year, month, i);
            const dateStr = d.toISOString().split("T")[0];
            const postCount = posts.filter(p => p.scheduled_date === dateStr).length;
            dates.push({ date: d, hasPost: postCount > 0, count: postCount });
        }
        return dates;
    }, [calendarMonth, posts]);

    const getPackageName = (packageId: number) => {
        return packages.find(p => p.id === packageId)?.name || "-";
    };

    const formatTime = (timeStr: string) => {
        return timeStr?.substring(0, 5) || "10:00";
    };

    const statsCards = [
        {
            label: "Pendapatan Hari Ini",
            value: formatRupiah(todayRevenue),
            desc: "Pemasukan harian",
            icon: Wallet,
            className: "bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 text-white border-0",
            iconClass: "bg-white/20 text-white",
            progressColor: "bg-white/30",
        },
        {
            label: "Posting Bulan Ini",
            value: thisMonthPosts.length.toString(),
            subtext: revenueChange !== 0 ? `${Math.abs(revenueChange)}%` : undefined,
            trend: revenueChange > 0 ? "up" : revenueChange < 0 ? "down" : undefined,
            desc: "Total terpost",
            icon: FileText,
            className: "bg-gradient-to-br from-indigo-500 to-indigo-600 dark:from-indigo-600 dark:to-indigo-700 text-white border-0",
            iconClass: "bg-white/20 text-white",
            progressColor: "bg-white/30",
        },
        {
            label: "Selesai",
            value: totalCompleted.toString(),
            desc: "Status posted",
            icon: CheckCircle2,
            className: "bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white border-0",
            iconClass: "bg-white/20 text-white",
            progressColor: "bg-white/30",
        },
        {
            label: "Total Omzet",
            value: formatRupiah(thisMonthRevenue),
            desc: "Bulan ini",
            icon: TrendingUp,
            className: "bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 text-white border-0",
            iconClass: "bg-white/20 text-white",
            progressColor: "bg-white/30",
        },
    ];

    return (
        <motion.div
            className="space-y-8 pb-8"
            variants={container}
            initial="hidden"
            animate="show"
        >
            {/* Header */}
            <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        {greeting}, Admin! <span className="text-2xl animate-pulse">👋</span>
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4 ml-0.5" />
                        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                </div>
                <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading} className="rounded-full hover:bg-muted">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </motion.div>

            {/* Alerts */}
            {overduePosts.length > 0 && (
                <motion.div variants={item}>
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 dark:bg-red-900/20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-destructive/20 text-destructive rounded-full">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-destructive dark:text-red-400">
                                    {overduePosts.length} Posting Terlambat
                                </h3>
                                <p className="text-sm text-destructive/80 dark:text-red-300/80">Perlu tindakan segera!</p>
                            </div>
                        </div>
                        <Link href="/admin/antri" className="w-full sm:w-auto">
                            <Button size="sm" variant="destructive" className="w-full sm:w-auto rounded-full">
                                Cek Posting <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            )}

            {/* Stats Cards - Colorful & Vibrant */}
            <motion.div variants={item} className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {statsCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <motion.div
                            key={stat.label}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <Card className={`relative overflow-hidden shadow-md h-full ${stat.className}`}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`p-3 rounded-xl backdrop-blur-sm ${stat.iconClass}`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        {stat.trend && (
                                            <div className="bg-white/20 px-2 py-1 rounded-full text-xs font-medium text-white flex items-center">
                                                {stat.trend === "up" ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                {stat.subtext}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white/80">{stat.label}</p>
                                        <h3 className="text-2xl font-bold mt-1 text-white">{stat.value}</h3>
                                        <div className="mt-3 w-full h-1 bg-black/10 rounded-full overflow-hidden">
                                            <div className={`h-full ${stat.progressColor} w-2/3 rounded-full`} />
                                        </div>
                                    </div>
                                </CardContent>
                                {/* Background Pattern Decoration */}
                                <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12">
                                    <Icon className="w-32 h-32 text-white" />
                                </div>
                            </Card>
                        </motion.div>
                    );
                })}
            </motion.div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-1 lg:grid-cols-7">
                {/* Main Content Area */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Today's Schedule */}
                    <motion.div variants={item}>
                        <Card className="border-border/50 shadow-sm bg-card hover:shadow-md transition-all">
                            <CardHeader className="flex flex-row items-center justify-between px-6 py-5 border-b border-border/50">
                                <div>
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <CalendarCheck className="w-5 h-5 text-indigo-500" />
                                        Jadwal Hari Ini
                                    </CardTitle>
                                    <CardDescription>
                                        {todaySchedule.length} postingan perlu diproses
                                    </CardDescription>
                                </div>
                                <Link href="/admin/antri">
                                    <Button variant="ghost" className="text-primary hover:bg-primary/5">
                                        Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                {todaySchedule.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="font-semibold text-foreground">Agenda Kosong</h3>
                                        <p className="text-sm mt-1">Tidak ada postingan dijadwalkan hari ini.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {todaySchedule.slice(0, 4).map((post) => (
                                            <div key={post.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-default">
                                                {/* Thumbnail with Time Overlay */}
                                                <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-muted border border-border">
                                                    {post.poster_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={post.poster_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-6 h-6 text-muted-foreground/50" />
                                                        </div>
                                                    )}
                                                    <div className="absolute bottom-0 w-full bg-black/60 backdrop-blur-[2px] text-white text-[10px] font-medium text-center py-0.5">
                                                        {formatTime(post.scheduled_time)}
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <h4 className="font-bold text-foreground truncate max-w-[200px]">{post.company_name}</h4>
                                                        <Badge variant="outline" className="text-[10px] font-normal border-primary/20 bg-primary/5 text-primary">
                                                            {getPackageName(post.package_id)}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" /> {formatTime(post.scheduled_time)} WIB
                                                    </p>
                                                    <p className="text-xs font-semibold text-primary mt-0.5">
                                                        {formatRupiah(post.total_price)}
                                                    </p>
                                                </div>

                                                {/* Status */}
                                                <Badge className={`px-2.5 py-0.5 whitespace-nowrap ${post.status === "posted" ? "bg-emerald-500 hover:bg-emerald-600" :
                                                    "bg-amber-500 hover:bg-amber-600 text-white"
                                                    }`}>
                                                    {post.status === "posted" ? "Selesai" : "Antri"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Revenue Chart Widget */}
                    <motion.div variants={item}>
                        <Card className="border-none shadow-md bg-zinc-900 dark:bg-card dark:border dark:border-border text-white overflow-hidden relative">
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 p-32 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
                            <div className="absolute bottom-0 left-0 p-20 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />

                            <CardHeader className="relative z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-lg text-white dark:text-foreground">
                                            <TrendingUp className="w-5 h-5 text-emerald-400" />
                                            Grafik Pendapatan
                                        </CardTitle>
                                        <CardDescription className="text-zinc-400 dark:text-muted-foreground">
                                            Performa 7 hari terakhir
                                        </CardDescription>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-zinc-500 dark:text-muted-foreground">Total Periode Ini</p>
                                        <p className="text-lg font-bold text-emerald-400">{formatRupiah(last7DaysRevenue.reduce((a, b) => a + b.revenue, 0))}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="h-44 mt-2 relative">
                                    {/* Grid Lines */}
                                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                        <div className="w-full border-t border-dashed border-white/5 dark:border-border/50" />
                                        <div className="w-full border-t border-dashed border-white/5 dark:border-border/50" />
                                        <div className="w-full border-t border-dashed border-white/5 dark:border-border/50" />
                                        <div className="w-full border-t border-white/10 dark:border-border" />
                                    </div>

                                    {/* Bars */}
                                    <div className="absolute inset-0 flex items-end justify-between gap-3 pt-4 px-2">
                                        {last7DaysRevenue.map((day) => {
                                            const heightPercent = Math.max((day.revenue / maxRevenue) * 100, 5);
                                            const isToday = day.date === today;

                                            return (
                                                <div key={day.date} className="flex-1 flex flex-col items-center gap-3 group relative h-full justify-end">
                                                    <div className="relative w-full flex justify-center items-end h-[85%]">
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${heightPercent}%` }}
                                                            transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
                                                            className={`w-full max-w-[30px] rounded-t-sm transition-all relative ${day.revenue > 0
                                                                    ? "bg-gradient-to-t from-emerald-600 to-emerald-400 dark:from-emerald-700 dark:to-emerald-500 group-hover:to-emerald-300"
                                                                    : "bg-white/5 dark:bg-white/5 group-hover:bg-white/10"
                                                                }`}
                                                        >
                                                            {/* Tooltip */}
                                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-bold px-2 py-1.5 rounded-md shadow-xl opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 whitespace-nowrap z-20 pointer-events-none ring-1 ring-white/10">
                                                                {formatRupiah(day.revenue)}
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                    <span className={`text-[10px] font-medium uppercase tracking-wider ${isToday ? "text-emerald-400" : "text-zinc-500 dark:text-muted-foreground"
                                                        }`}>
                                                        {new Date(day.date).toLocaleDateString("id-ID", { weekday: "short" }).substring(0, 3)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Sidebar Content Area */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Quick Actions Grid */}
                    <motion.div variants={item}>
                        <Card className="border-border/50 shadow-sm bg-card">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-amber-500" />
                                    Akses Cepat
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-3">
                                {[
                                    { title: "Invoice", href: "/admin/invoice", icon: FileText, color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
                                    { title: "Posting", href: "/admin/antri", icon: ListTodo, color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
                                    { title: "Keuangan", href: "/admin/keuangan", icon: Wallet, color: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
                                    { title: "Biolink", href: "/admin/biolink", icon: ArrowUpRight, color: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400" },
                                ].map((action, i) => {
                                    const Icon = action.icon;
                                    return (
                                        <Link key={i} href={action.href}>
                                            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-muted/40 border border-transparent hover:border-border hover:bg-muted hover:shadow-sm transition-all cursor-pointer group h-full">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${action.color}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <span className="font-semibold text-sm text-foreground">{action.title}</span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Calendar Widget */}
                    <motion.div variants={item}>
                        <Card className="border-none shadow-sm bg-card overflow-hidden">
                            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
                                <h3 className="font-bold text-lg">
                                    {calendarMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                                </h3>
                                <div className="flex gap-1">
                                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="p-1 hover:bg-white/20 rounded">
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="p-1 hover:bg-white/20 rounded">
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-card">
                                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                    {["M", "S", "S", "R", "K", "J", "S"].map((d, i) => (
                                        <div key={i} className="text-xs font-bold text-muted-foreground">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1 text-center">
                                    {calendarDates.map((d, i) => {
                                        const isToday = d.date.toISOString().split("T")[0] === today;
                                        const isCurrentMonth = d.date.getMonth() === calendarMonth.getMonth();
                                        return (
                                            <div
                                                key={i}
                                                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative transition-colors ${isToday
                                                    ? "bg-indigo-600 text-white font-bold shadow-md"
                                                    : !isCurrentMonth
                                                        ? "text-muted-foreground/30"
                                                        : "text-foreground hover:bg-primary/10 cursor-pointer"
                                                    }`}
                                            >
                                                {d.date.getDate()}
                                                {d.hasPost && isCurrentMonth && !isToday && (
                                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-0.5" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Top Clients */}
                    <motion.div variants={item}>
                        <Card className="border-border/50 shadow-sm bg-card">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Users className="w-5 h-5 text-muted-foreground" />
                                    Top Klien
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {repeatClients.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Belum ada data cukup.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {repeatClients.slice(0, 4).map(([name, count], i) => (
                                            <div key={name} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                                                    i === 1 ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" :
                                                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                                    }`}>
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate text-foreground">{name}</p>
                                                    <p className="text-xs text-muted-foreground">{count} order bulan ini</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
}
