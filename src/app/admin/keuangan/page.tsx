"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    TrendingUp,
    TrendingDown,
    Wallet,
    Building2,
    Home,
    Download,
    RefreshCw,
    Search,
    Filter,
    X,
    Edit3,
    Trash2,
    MoreVertical,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle2,
    PieChart,
    BarChart3,
    ArrowRightLeft,
    ChevronDown,
    Check,
    FileText,
    Receipt,
    Package
} from "lucide-react";
import { formatRupiah, getTodayWIB } from "@/lib/utils";
import type {
    Transaction,
    TransactionMode,
    TransactionType,
    TransactionCategory,
    FinanceDashboard,
    BusinessIncomeCategory,
    BusinessExpenseCategory,
    PersonalIncomeCategory,
    PersonalExpenseCategory,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    getTransactions,
    getFinanceDashboard,
    getMonthlyData,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    getCategoryIcon,
    getCategoryLabel,
    type TransactionFilters,
} from "@/lib/finance-service";
import { getPostingById, getPackages, getAddons } from "@/lib/posting-service";
import type { QueuePost, PostingPackage, PostingAddon } from "@/lib/types";
import toast from "react-hot-toast";

// ============================================
// CONFIGURATION
// ============================================

const BUSINESS_INCOME_CATEGORIES: { value: BusinessIncomeCategory; label: string; icon: string }[] = [
    { value: "posting", label: "Posting Loker", icon: "📝" },
    { value: "boost", label: "Boost Iklan", icon: "🚀" },
    { value: "sponsor", label: "Sponsorship", icon: "🤝" },
    { value: "other_income", label: "Lainnya", icon: "💰" },
];

const BUSINESS_EXPENSE_CATEGORIES: { value: BusinessExpenseCategory; label: string; icon: string }[] = [
    { value: "internet", label: "Internet", icon: "🌐" },
    { value: "hosting", label: "Server/Hosting", icon: "🖥️" },
    { value: "marketing", label: "Marketing", icon: "📢" },
    { value: "tools", label: "Software Tools", icon: "🛠️" },
    { value: "other_biz", label: "Operasional Lain", icon: "💼" },
];

const PERSONAL_INCOME_CATEGORIES: { value: PersonalIncomeCategory; label: string; icon: string }[] = [
    { value: "salary", label: "Gaji/Upah", icon: "💵" },
    { value: "freelance", label: "Freelance", icon: "💻" },
    { value: "gift", label: "Hadiah/Bonus", icon: "🎁" },
    { value: "investment", label: "Investasi", icon: "📈" },
    { value: "other_personal_income", label: "Lainnya", icon: "💸" },
];

const PERSONAL_EXPENSE_CATEGORIES: { value: PersonalExpenseCategory; label: string; icon: string }[] = [
    { value: "food", label: "Makan & Minum", icon: "🍔" },
    { value: "transport", label: "Transportasi", icon: "🚗" },
    { value: "shopping", label: "Belanja", icon: "🛒" },
    { value: "bills", label: "Tagihan Rutin", icon: "💡" },
    { value: "health", label: "Kesehatan", icon: "💊" },
    { value: "entertainment", label: "Hiburan", icon: "🎮" },
    { value: "other", label: "Lainnya", icon: "📦" },
];

// ============================================
// COMPONENT
// ============================================

export default function KeuanganPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
    const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expense: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [packages, setPackages] = useState<PostingPackage[]>([]);
    const [addons, setAddons] = useState<PostingAddon[]>([]);
    
    // Invoice Modal State
    const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
    const [selectedInvoiceTx, setSelectedInvoiceTx] = useState<Transaction | null>(null);
    const [selectedPostDetails, setSelectedPostDetails] = useState<QueuePost | null>(null);
    const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);

    // UI State
    const [activeTab, setActiveTab] = useState<"dashboard" | "business" | "personal">("dashboard");
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<TransactionType | "all">("all");
    const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");

    // Form State
    const [formOpen, setFormOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [formMode, setFormMode] = useState<TransactionMode>("business");
    const [formType, setFormType] = useState<TransactionType>("income");
    const [formAmount, setFormAmount] = useState("");
    const [formCategory, setFormCategory] = useState<TransactionCategory>("posting");
    const [formDescription, setFormDescription] = useState("");
    const [formDate, setFormDate] = useState(getTodayWIB());
    const [formStatus, setFormStatus] = useState<Transaction["status"]>("paid");
    const [formClient, setFormClient] = useState("");

    // New Category State
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        loadData();
        loadPackagesAndAddons();
    }, []);

    const loadPackagesAndAddons = async () => {
        const [pkgRes, addonRes] = await Promise.all([getPackages(), getAddons()]);
        if (pkgRes.data) setPackages(pkgRes.data);
        if (addonRes.data) setAddons(addonRes.data);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [txRes, dashRes, monthRes] = await Promise.all([
                getTransactions(),
                getFinanceDashboard(),
                getMonthlyData(6),
            ]);

            if (txRes.error) toast.error(txRes.error);
            setTransactions(txRes.data);
            setDashboard(dashRes.data);
            setMonthlyData(monthRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    // Filter Logic
    const filteredTransactions = transactions.filter(t => {
        if (activeTab === "business" && t.mode !== "business") return false;
        if (activeTab === "personal" && t.mode !== "personal") return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!t.description?.toLowerCase().includes(query) &&
                !t.client?.toLowerCase().includes(query) &&
                !getCategoryLabel(t.category).toLowerCase().includes(query)) {
                return false;
            }
        }

        if (filterType !== "all" && t.type !== filterType) return false;
        if (filterStatus !== "all" && t.status !== filterStatus) return false;

        return true;
    });

    const getFormCategories = () => {
        let defaultCats: { value: string; label: string; icon: string }[] = [];

        if (formMode === "business") {
            defaultCats = formType === "income" ? BUSINESS_INCOME_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
        } else {
            defaultCats = formType === "income" ? PERSONAL_INCOME_CATEGORIES : PERSONAL_EXPENSE_CATEGORIES;
        }

        // Find used categories from existing transactions
        const usedCats = new Set<string>();
        transactions.forEach(t => {
            if (t.mode === formMode && t.type === formType) {
                usedCats.add(t.category);
            }
        });

        // Filter out those that are already in default lists to avoid duplicates
        const defaultValues = new Set(defaultCats.map(c => c.value));
        const dynamicCats = Array.from(usedCats)
            .filter(c => !defaultValues.has(c))
            .map(c => ({ value: c, label: c, icon: "✨" }));

        return [...defaultCats, ...dynamicCats];
    };

    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        const slug = newCategoryName.toLowerCase().replace(/\s+/g, '_');
        setFormCategory(slug as TransactionCategory);
        setIsAddingCategory(false);
        setNewCategoryName("");
    };

    const handleEditTransaction = (tx: Transaction) => {
        setEditingTransaction(tx);
        setFormMode(tx.mode);
        setFormType(tx.type);
        setFormAmount(tx.amount.toString());
        setFormCategory(tx.category);
        setFormDescription(tx.description || "");
        setFormDate(tx.date);
        setFormStatus(tx.status);
        setFormClient(tx.client || "");
        setFormOpen(true);
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!window.confirm("Apakah Anda yakin ingin menghapus transaksi ini? Data yang dihapus tidak dapat dikembalikan.")) {
            return;
        }
        
        setIsLoading(true);
        try {
            const { error } = await deleteTransaction(id);
            if (error) {
                toast.error("Gagal menghapus transaksi");
                return;
            }
            toast.success("Transaksi berhasil dihapus");
            loadData();
        } catch (error) {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFormSubmit = async () => {
        if (!formAmount || Number(formAmount) <= 0) {
            toast.error("Masukkan jumlah yang valid");
            return;
        }

        try {
            const payload = {
                mode: formMode,
                type: formType,
                amount: Number(formAmount),
                category: formCategory,
                description: formDescription,
                date: formDate,
                status: formStatus,
                client: formClient || undefined,
            };

            if (editingTransaction) {
                const { error } = await updateTransaction(editingTransaction.id, payload);
                if (error) throw new Error(error);
                toast.success("Transaksi diperbarui!");
            } else {
                const { error } = await createTransaction(payload);
                if (error) throw new Error(error);
                toast.success("Transaksi ditambahkan!");
            }

            setFormOpen(false);
            resetForm();
            loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
        }
    };

    const resetForm = () => {
        setEditingTransaction(null);
        setFormAmount("");
        setFormDescription("");
        setFormDate(getTodayWIB());
        setFormStatus("paid");
        setFormClient("");
        // Reset category based on current mode/type defaults
        if (formMode === "business") setFormCategory(formType === "income" ? "posting" : "internet");
        else setFormCategory(formType === "income" ? "salary" : "food");
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const { error } = await deleteTransaction(deleteId);
        if (error) toast.error(error);
        else {
            toast.success("Transaksi dihapus");
            loadData();
        }
        setDeleteId(null);
    };

    const handleViewInvoice = async (tx: Transaction) => {
        setSelectedInvoiceTx(tx);
        setSelectedPostDetails(null);
        setInvoiceModalOpen(true);
        if (tx.related_post_id) {
            setIsFetchingInvoice(true);
            try {
                const res = await getPostingById(tx.related_post_id);
                if (res.data) setSelectedPostDetails(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setIsFetchingInvoice(false);
            }
        }
    };

    const groupedTransactions = filteredTransactions.reduce((acc, tx) => {
        const dateObj = new Date(tx.date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateLabel = "";
        
        if (dateObj.toDateString() === today.toDateString()) {
            dateLabel = "Hari Ini";
        } else if (dateObj.toDateString() === yesterday.toDateString()) {
            dateLabel = "Kemarin";
        } else {
            dateLabel = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        }
        
        if (!acc[dateLabel]) {
            acc[dateLabel] = [];
        }
        acc[dateLabel].push(tx);
        return acc;
    }, {} as Record<string, Transaction[]>);

    const maxChartValue = Math.max(...monthlyData.map(d => Math.max(d.income, d.expense)), 1);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                        Keuangan
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">
                        Monitoring arus kas bisnis dan pengeluaran personal
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading} className="h-9 flex-1 sm:flex-none">
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Sync
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 flex-1 sm:flex-none">
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>Export CSV</DropdownMenuItem>
                            <DropdownMenuItem>Export PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => { resetForm(); setFormOpen(true); }} className="h-9 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 flex-1 sm:flex-none w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" /> Transaksi Baru
                    </Button>
                </div>
            </div>

            {/* Custom Tabs - Fit to screen on mobile */}
            <div className="w-full">
                <div className="flex items-center bg-muted/50 p-1 rounded-xl w-full sm:w-fit border border-border/50">
                    {(["dashboard", "business", "personal"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                relative flex-1 sm:flex-none px-2 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 z-10 text-center
                                ${activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}
                            `}
                        >
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-background shadow-sm rounded-lg border border-border/50"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                                {tab === "dashboard" && <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                {tab === "business" && <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                {tab === "personal" && <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === "dashboard" && (
                    <motion.div
                        key="dashboard"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                    >
                        {/* Bento Grid Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Total Card */}
                            <Card className="col-span-1 md:col-span-2 relative overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-700 border-none text-white shadow-xl shadow-indigo-500/20">
                                <CardContent className="p-6 relative z-10">
                                    <div className="flex justify-between items-start mb-6 md:mb-8">
                                        <div>
                                            <p className="text-indigo-100 font-medium mb-1 text-sm md:text-base">Total Saldo Bersih</p>
                                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                                                {formatRupiah(dashboard?.total_balance || 0)}
                                            </h2>
                                        </div>
                                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                                            <Wallet className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                                            <div className="flex items-center gap-2 text-indigo-100 mb-1 text-xs md:text-sm">
                                                <TrendingUp className="w-3 h-3 md:w-4 md:h-4" /> Pemasukan
                                            </div>
                                            <p className="text-base md:text-lg font-semibold truncate">
                                                {formatRupiah((dashboard?.business_income || 0) + (dashboard?.personal_income || 0))}
                                            </p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
                                            <div className="flex items-center gap-2 text-indigo-100 mb-1 text-xs md:text-sm">
                                                <TrendingDown className="w-3 h-3 md:w-4 md:h-4" /> Pengeluaran
                                            </div>
                                            <p className="text-base md:text-lg font-semibold truncate">
                                                {formatRupiah((dashboard?.business_expense || 0) + (dashboard?.personal_expense || 0))}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                                {/* Decorative Circles */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                            </Card>

                            {/* Business Status */}
                            <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-violet-200/50 dark:border-violet-800/50 bg-gradient-to-br from-white to-violet-50/50 dark:from-background dark:to-violet-900/10">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <Badge variant="outline" className="border-violet-200 text-violet-700 bg-violet-50">Bisnis</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm font-medium">Saldo Bisnis</p>
                                    <h3 className="text-2xl font-bold text-foreground mt-1 mb-2">
                                        {formatRupiah(dashboard?.business_balance || 0)}
                                    </h3>
                                    <div className="h-1.5 w-full bg-violet-100 dark:bg-violet-900/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-violet-500 rounded-full" style={{ width: '70%' }} />
                                    </div>
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                        <span>Income: {formatRupiah(dashboard?.business_income || 0)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Personal Status */}
                            <Card className="relative overflow-hidden group hover:shadow-lg transition-all border-emerald-200/50 dark:border-emerald-800/50 bg-gradient-to-br from-white to-emerald-50/50 dark:from-background dark:to-emerald-900/10">
                                <CardContent className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                            <Home className="w-6 h-6" />
                                        </div>
                                        <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">Personal</Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm font-medium">Saldo Personal</p>
                                    <h3 className="text-2xl font-bold text-foreground mt-1 mb-2">
                                        {formatRupiah(dashboard?.personal_balance || 0)}
                                    </h3>
                                    <div className="h-1.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '45%' }} />
                                    </div>
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                        <span>Expense: {formatRupiah(dashboard?.personal_expense || 0)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {/* Chart Section */}
                            <Card className="xl:col-span-2 shadow-sm relative overflow-hidden">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                                        Analitik Keuangan
                                    </CardTitle>
                                    <CardDescription>Perbandingan pemasukan dan pengeluaran 6 bulan terakhir</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 sm:p-6">
                                    <div className="h-[250px] w-full overflow-x-auto px-4 pb-4">
                                        <div className="h-full flex items-end justify-between gap-4 min-w-[500px] sm:min-w-0">
                                            {monthlyData.map((data, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative min-w-[40px]">
                                                    <div className="w-full flex gap-1 items-end justify-center h-full relative">
                                                        {/* Income Bar */}
                                                        <div className="w-full max-w-[24px] bg-indigo-500/10 dark:bg-indigo-500/20 rounded-t-sm relative group-hover:bg-indigo-500/20 transition-all duration-300 h-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: `${(data.income / maxChartValue) * 100}%` }}
                                                                transition={{ delay: i * 0.1, duration: 1, ease: "easeOut" }}
                                                                className="absolute bottom-0 w-full bg-indigo-500 rounded-t-sm"
                                                            />
                                                        </div>
                                                        {/* Expense Bar */}
                                                        <div className="w-full max-w-[24px] bg-rose-500/10 dark:bg-rose-500/20 rounded-t-sm relative group-hover:bg-rose-500/20 transition-all duration-300 h-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ height: 0 }}
                                                                animate={{ height: `${(data.expense / maxChartValue) * 100}%` }}
                                                                transition={{ delay: i * 0.1 + 0.1, duration: 1, ease: "easeOut" }}
                                                                className="absolute bottom-0 w-full bg-rose-500 rounded-t-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-medium text-muted-foreground">{data.month}</span>

                                                    {/* Tooltip */}
                                                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-popover border text-popover-foreground text-xs p-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-50">
                                                        <div className="flex gap-3">
                                                            <span className="text-indigo-500">+{formatRupiah(data.income)}</span>
                                                            <span className="text-rose-500">-{formatRupiah(data.expense)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Transactions List (Compact) */}
                            <Card className="shadow-sm flex flex-col">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">Transaksi Terkini</CardTitle>
                                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveTab("business")}>
                                            Lihat Semua
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-hidden">
                                    <ScrollArea className="h-[300px] pr-4">
                                        <div className="space-y-3">
                                            {transactions.slice(0, 6).map((tx, i) => (
                                                <motion.div
                                                    key={tx.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted transition-colors border border-transparent hover:border-border/50 group w-full min-w-0 gap-2"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className={`p-2 rounded-lg text-lg flex-shrink-0 ${tx.mode === "business" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"}`}>
                                                            {getCategoryIcon(tx.category)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate w-full">
                                                                {tx.description || getCategoryLabel(tx.category)}
                                                            </p>
                                                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                                                <Clock className="w-3 h-3 flex-shrink-0 hidden sm:block" />
                                                                <span className="truncate">{new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                                                                <span className="mx-0.5 flex-shrink-0">•</span>
                                                                {tx.payment_method === "ewallet" || tx.notes?.includes("Auto dari QRIS") ? (
                                                                    <span className="text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0 truncate max-w-[50px] sm:max-w-none">Auto</span>
                                                                ) : (
                                                                    <span className="text-slate-600 font-semibold bg-slate-50 border px-1.5 py-0.5 rounded flex-shrink-0 truncate max-w-[50px] sm:max-w-none">Manual</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-right flex-shrink-0">
                                                        <p className={`font-semibold text-xs sm:text-sm whitespace-nowrap ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                                                            {tx.type === "income" ? "+" : "-"}{formatRupiah(tx.amount)}
                                                        </p>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleViewInvoice(tx)}>
                                                                    <Receipt className="w-4 h-4 mr-2 text-indigo-600" /> Detail Nota
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => {
                                                                    setEditingTransaction(tx);
                                                                    setFormMode(tx.mode);
                                                                    setFormType(tx.type);
                                                                    setFormAmount(tx.amount.toString());
                                                                    setFormCategory(tx.category);
                                                                    setFormDescription(tx.description || "");
                                                                    setFormDate(tx.date);
                                                                    setFormStatus(tx.status);
                                                                    setFormClient(tx.client || "");
                                                                    setFormOpen(true);
                                                                }}>
                                                                    <Edit3 className="w-4 h-4 mr-2" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(tx.id)}>
                                                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    </motion.div>
                )}

                {(activeTab === "business" || activeTab === "personal") && (
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Card className="border-none shadow-none bg-transparent">
                            {/* Toolbar */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6 sticky top-0 bg-background/95 backdrop-blur z-20 py-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Cari transaksi..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 h-10 bg-muted/40 border-muted-foreground/20"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground"
                                            onClick={() => setSearchQuery("")}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                                        <SelectTrigger className="w-[130px] h-10 bg-muted/40 border-muted-foreground/20">
                                            <div className="flex items-center gap-2">
                                                <Filter className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue placeholder="Tipe" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua</SelectItem>
                                            <SelectItem value="income">Income</SelectItem>
                                            <SelectItem value="expense">Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                                        <SelectTrigger className="w-[130px] h-10 bg-muted/40 border-muted-foreground/20">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                                                <SelectValue placeholder="Status" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua</SelectItem>
                                            <SelectItem value="paid">Lunas</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Transactions List */}
                            <div className="grid gap-3">
                                {filteredTransactions.length === 0 ? (
                                    <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
                                        <div className="p-4 bg-muted/50 rounded-full w-fit mx-auto mb-4">
                                            <Wallet className="w-8 h-8 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-lg font-medium text-foreground">Belum ada transaksi</h3>
                                        <p className="text-muted-foreground">Mulai catat keuanganmu sekarang</p>
                                        <Button variant="link" onClick={() => { setFormMode(activeTab); resetForm(); setFormOpen(true); }}>
                                            Tambah Transaksi Baru
                                        </Button>
                                    </div>
                                ) : (
                                    Object.entries(groupedTransactions).map(([dateLabel, groupTxs], groupIndex) => (
                                        <div key={dateLabel} className="space-y-3">
                                            <div className="sticky top-[140px] z-10 bg-background/95 backdrop-blur py-2">
                                                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    {dateLabel}
                                                </h3>
                                            </div>
                                            {groupTxs.map((tx, index) => (
                                                <motion.div
                                                    key={tx.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-border hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-start gap-4 mb-3 sm:mb-0">
                                                        <div className={`p-3 rounded-2xl text-2xl flex-shrink-0 ${tx.mode === "business" ? "bg-violet-50 text-violet-600 dark:bg-violet-900/20" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"}`}>
                                                            {getCategoryIcon(tx.category)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-semibold text-base leading-tight break-words">
                                                                    {tx.description || getCategoryLabel(tx.category)}
                                                                </h4>
                                                                {tx.status === "pending" && (
                                                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 h-5 text-[10px] whitespace-nowrap">
                                                                        Pending
                                                                    </Badge>
                                                                )}
                                                                {tx.payment_method === "ewallet" || tx.notes?.includes("Auto dari QRIS") ? (
                                                                    <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 h-5 text-[10px] whitespace-nowrap">
                                                                        Auto QRIS
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50 h-5 text-[10px] whitespace-nowrap">
                                                                        Manual
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                                                                <span className="flex items-center gap-1">
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    {new Date(tx.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                                                </span>
                                                                {tx.client && (
                                                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-xs break-words">
                                                                        <Building2 className="w-3 h-3 flex-shrink-0" />
                                                                        <span>{tx.client}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                                                        <div className="text-left sm:text-right">
                                                            <p className={`text-lg font-bold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                                                                {tx.type === "income" ? "+" : "-"}{formatRupiah(tx.amount)}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground capitalize">
                                                                {getCategoryLabel(tx.category)}
                                                            </p>
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreVertical className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleViewInvoice(tx)}>
                                                                    <Receipt className="w-4 h-4 mr-2 text-indigo-600" /> Detail Nota
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleEditTransaction(tx)}>
                                                                    <Edit3 className="w-4 h-4 mr-2" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() => handleDeleteTransaction(tx.id)}
                                                                    className="text-destructive focus:text-destructive"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add/Edit Transaction Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-[425px] overflow-hidden p-0 gap-0">
                    <div className="px-6 py-4 bg-muted/30 border-b">
                        <DialogTitle className="text-xl">
                            {editingTransaction ? "Edit Transaksi" : "Tambah Transaksi"}
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">Isi detail transaksi di bawah ini.</p>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Mode & Type Toggle Group */}
                        <div className="flex p-1 bg-muted rounded-lg">
                            <button
                                type="button"
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formMode === "business" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                                onClick={() => { setFormMode("business"); setFormCategory("posting"); }}
                            >
                                💼 Bisnis
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formMode === "personal" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                                onClick={() => { setFormMode("personal"); setFormCategory("food"); }}
                            >
                                🏠 Personal
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div
                                className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formType === "income" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : "border-border hover:border-emerald-200"}`}
                                onClick={() => { setFormType("income"); setFormCategory(formMode === "business" ? "posting" : "salary"); }}
                            >
                                <div className={`p-2 rounded-full ${formType === "income" ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                <span className={`text-sm font-medium ${formType === "income" ? "text-emerald-700" : "text-muted-foreground"}`}>Pemasukan</span>
                            </div>

                            <div
                                className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${formType === "expense" ? "border-rose-500 bg-rose-50 dark:bg-rose-950/20" : "border-border hover:border-rose-200"}`}
                                onClick={() => { setFormType("expense"); setFormCategory(formMode === "business" ? "internet" : "food"); }}
                            >
                                <div className={`p-2 rounded-full ${formType === "expense" ? "bg-rose-500 text-white" : "bg-muted text-muted-foreground"}`}>
                                    <TrendingDown className="w-4 h-4" />
                                </div>
                                <span className={`text-sm font-medium ${formType === "expense" ? "text-rose-700" : "text-muted-foreground"}`}>Pengeluaran</span>
                            </div>
                        </div>

                        {/* Amount Input */}
                        <div className="relative">
                            <Label className="text-xs text-muted-foreground ml-1">Jumlah Uang</Label>
                            <div className="relative mt-1.5">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                                <Input
                                    type="number"
                                    value={formAmount}
                                    onChange={(e) => setFormAmount(e.target.value)}
                                    className="pl-10 text-lg font-bold h-12"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Category Grid */}
                        <div>
                            <Label className="text-xs text-muted-foreground ml-1 mb-2 block">Kategori</Label>
                            {isAddingCategory ? (
                                <div className="flex gap-2 items-center animate-in fade-in zoom-in-95">
                                    <Input
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="Nama kategori baru..."
                                        className="h-10"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCategory();
                                            }
                                        }}
                                    />
                                    <Button size="icon" onClick={handleAddCategory} type="button" className="h-10 w-10 shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => setIsAddingCategory(false)} type="button" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive">
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {getFormCategories().map((cat) => (
                                        <button
                                            key={cat.value}
                                            type="button"
                                            onClick={() => setFormCategory(cat.value)}
                                            className={`
                                                flex flex-col items-center justify-center p-2 rounded-lg border transition-all gap-1 h-20
                                                ${formCategory === cat.value
                                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                    : "border-border hover:bg-muted hover:border-muted-foreground/30"
                                                }
                                            `}
                                        >
                                            <span className="text-2xl">{cat.icon}</span>
                                            <span className="text-[10px] text-center leading-tight line-clamp-2 text-muted-foreground">
                                                {cat.label}
                                            </span>
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingCategory(true)}
                                        className="flex flex-col items-center justify-center p-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all gap-1 h-20 group"
                                    >
                                        <div className="p-1.5 rounded-full bg-muted group-hover:bg-primary/20 transition-colors">
                                            <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">Tambah</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Extra Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Tanggal</Label>
                                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Status</Label>
                                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as any)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="paid">✅ Lunas</SelectItem>
                                        <SelectItem value="pending">⏳ Pending</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formMode === "business" && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Klien (Opsional)</Label>
                                <Input placeholder="Nama klien/perusahaan" value={formClient} onChange={(e) => setFormClient(e.target.value)} />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Catatan</Label>
                            <Textarea
                                placeholder="Keterangan transaksi..."
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                rows={2}
                                className="resize-none"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 border-t flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setFormOpen(false)}>Batal</Button>
                        <Button onClick={handleFormSubmit} className="min-w-[100px]">Simpan</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent className="sm:max-w-xs p-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto mb-4">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-lg">Hapus Transaksi?</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-2 mb-6">
                        Data yang dihapus tidak dapat dikembalikan lagi.
                    </p>
                    <div className="flex justify-center gap-2">
                        <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Batal</Button>
                        <Button variant="destructive" onClick={handleDelete} className="flex-1">Hapus</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Invoice Detail Modal */}
            <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-border/50 shadow-xl">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-white relative">
                        <div className="absolute top-0 right-0 p-10 bg-white/10 blur-2xl rounded-full mix-blend-overlay pointer-events-none" />
                        <h3 className="text-lg font-bold">Nota Digital</h3>
                        <p className="text-indigo-100 text-sm mt-1">{selectedInvoiceTx?.client || selectedInvoiceTx?.description}</p>
                        <div className="mt-4 flex items-center justify-between bg-white/20 px-3 py-2 rounded-lg backdrop-blur-sm">
                            <span className="text-xs font-medium uppercase tracking-wider text-indigo-50">Total</span>
                            <span className="font-bold text-xl">{formatRupiah(selectedInvoiceTx?.amount || 0)}</span>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        {isFetchingInvoice ? (
                            <div className="flex flex-col items-center justify-center py-8">
                                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
                                <p className="text-sm text-muted-foreground">Memuat rincian...</p>
                            </div>
                        ) : selectedPostDetails ? (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Paket Utama</h4>
                                    <div className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border/50">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                <Package className="w-4 h-4" />
                                            </div>
                                            <span className="font-medium text-sm text-foreground">{packages.find(p => p.id === selectedPostDetails.package_id)?.name || "Paket"}</span>
                                        </div>
                                        <span className="font-semibold text-sm text-foreground">{formatRupiah(packages.find(p => p.id === selectedPostDetails.package_id)?.price || 0)}</span>
                                    </div>
                                </div>
                                
                                {selectedPostDetails.addons && selectedPostDetails.addons.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Add-on Tambahan</h4>
                                        <div className="space-y-2">
                                            {selectedPostDetails.addons.map(addonId => {
                                                const addon = addons.find(a => a.id === addonId);
                                                return (
                                                    <div key={addonId} className="flex justify-between items-center p-2.5 bg-muted/20 rounded-lg border border-transparent">
                                                        <span className="text-sm text-muted-foreground">{addon?.name || "Add-on"}</span>
                                                        <span className="font-medium text-sm text-foreground">{formatRupiah(addon?.price || 0)}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="pt-4 border-t border-border/50 mt-4 flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                        Tanggal: {new Date(selectedInvoiceTx?.date || "").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                    <Badge variant="outline" className={
                                        selectedInvoiceTx?.status === "paid" ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400" :
                                        selectedInvoiceTx?.status === "pending" ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400" :
                                        "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400"
                                    }>
                                        {selectedInvoiceTx?.status?.toUpperCase()}
                                    </Badge>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-sm text-muted-foreground">Rincian pesanan tidak tersedia untuk transaksi manual ini.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
