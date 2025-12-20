"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus,
    Trash2,
    GripVertical,
    Upload,
    Calendar,
    Clock,
    Edit3,
    MessageSquare,
    LayoutGrid,
    List,
    Phone,
    Package,
    RefreshCw,
    ExternalLink,
    TrendingUp,
    CalendarCheck,
    Wallet,
    FileText,
    ArrowRight,
    CheckCircle2,
    MoreVertical,
    Search,
    Copy,
    CalendarDays,
    Filter,
    X,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatRupiah } from "@/lib/utils";
import type { QueuePost, QueueStatus, PostingPackage, PostingAddon } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PostingForm } from "@/components/posting/posting-form";
import {
    getPostings,
    getPackages,
    getAddons,
    updatePostingStatus,
    deletePosting,
    generateWhatsAppLink,
} from "@/lib/posting-service";
import toast from "react-hot-toast";

const columns: { id: QueueStatus; title: string; color: string; bgColor: string }[] = [
    { id: "draft", title: "Memo / Draft", color: "text-slate-500", bgColor: "bg-slate-500/10" },
    { id: "queued", title: "Antrian Posting", color: "text-amber-500", bgColor: "bg-amber-500/10" },
    { id: "posted", title: "Sudah Diposting", color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
];

export default function AntriPage() {
    const [posts, setPosts] = useState<QueuePost[]>([]);
    const [packages, setPackages] = useState<PostingPackage[]>([]);
    const [addons, setAddons] = useState<PostingAddon[]>([]);
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [draggedPost, setDraggedPost] = useState<QueuePost | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Form dialog
    const [formOpen, setFormOpen] = useState(false);
    const [editingPost, setEditingPost] = useState<QueuePost | null>(null);

    // Delete confirmation
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Filter & Search
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<QueueStatus | "all">("all");
    const [showCalendar, setShowCalendar] = useState(false);

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [postsRes, packagesRes, addonsRes] = await Promise.all([
                getPostings(),
                getPackages(),
                getAddons(),
            ]);

            if (postsRes.error) toast.error(postsRes.error);
            if (packagesRes.error) toast.error(packagesRes.error);
            if (addonsRes.error) toast.error(addonsRes.error);

            setPosts(postsRes.data);
            setPackages(packagesRes.data);
            setAddons(addonsRes.data);
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    // Filter posts based on search and status
    const filteredPosts = posts.filter(post => {
        const matchesSearch = searchQuery === "" ||
            post.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.whatsapp_number.includes(searchQuery);
        const matchesStatus = statusFilter === "all" || post.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getPostsByStatus = (status: QueueStatus) => {
        return filteredPosts.filter((post) => post.status === status);
    };

    const getPackageName = (packageId: number) => {
        return packages.find(p => p.id === packageId)?.name || "-";
    };

    const handleDragStart = (post: QueuePost) => {
        setDraggedPost(post);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (status: QueueStatus) => {
        if (draggedPost && draggedPost.status !== status) {
            // Optimistic update
            setPosts(posts.map((post) =>
                post.id === draggedPost.id ? { ...post, status } : post
            ));

            // Update in database
            const { success, error } = await updatePostingStatus(draggedPost.id, status);
            if (!success) {
                toast.error(error || "Gagal update status");
                loadData(); // Revert on error
            } else {
                toast.success(`Status diubah ke ${status}`);
            }
        }
        setDraggedPost(null);
    };

    const handleEdit = (post: QueuePost) => {
        setEditingPost(post);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        const { success, error } = await deletePosting(deleteId);
        if (success) {
            setPosts(posts.filter(p => p.id !== deleteId));
            toast.success("Posting berhasil dihapus");
        } else {
            toast.error(error || "Gagal menghapus");
        }
        setDeleteId(null);
    };

    const handleWhatsApp = (post: QueuePost) => {
        const message = `Halo, mengenai posting lowongan ${post.company_name}...`;
        window.open(generateWhatsAppLink(post.whatsapp_number, message), "_blank");
    };

    // Quick status change without drag
    const handleQuickStatusChange = async (postId: string, newStatus: QueueStatus) => {
        // Optimistic update
        setPosts(posts.map((post) =>
            post.id === postId ? { ...post, status: newStatus } : post
        ));

        const { success, error } = await updatePostingStatus(postId, newStatus);
        if (!success) {
            toast.error(error || "Gagal update status");
            loadData();
        } else {
            const statusLabels: Record<QueueStatus, string> = {
                draft: "Draft",
                queued: "Antrian",
                posted: "Posted",
                cancelled: "Dibatalkan"
            };
            toast.success(`Status: ${statusLabels[newStatus]}`);
        }
    };

    // Get next status in workflow
    const getNextStatus = (currentStatus: QueueStatus): QueueStatus | null => {
        const workflow: Record<QueueStatus, QueueStatus | null> = {
            draft: "queued",
            queued: "posted",
            posted: null,
            cancelled: null
        };
        return workflow[currentStatus];
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const formatTime = (timeStr: string) => {
        return timeStr?.substring(0, 5) || "10:00";
    };

    // Copy/Duplicate posting
    const handleCopyPosting = async (post: QueuePost) => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        const newPost = {
            company_name: post.company_name + " (Copy)",
            whatsapp_number: post.whatsapp_number,
            poster_url: post.poster_url,
            scheduled_date: tomorrow.toISOString().split("T")[0],
            scheduled_time: post.scheduled_time,
            package_id: post.package_id,
            addons: post.addons,
            total_price: post.total_price,
            status: "draft" as const,
            notes: post.notes,
        };

        const { createPosting } = await import("@/lib/posting-service");
        const { data, error } = await createPosting(newPost);

        if (error) {
            toast.error(`Gagal copy: ${error}`);
        } else if (data) {
            setPosts([...posts, data]);
            toast.success("Posting berhasil di-copy!");
        }
    };

    // Group posts by date for calendar view
    const getPostsByDate = () => {
        const grouped: Record<string, QueuePost[]> = {};
        filteredPosts.forEach(post => {
            const date = post.scheduled_date;
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(post);
        });
        return grouped;
    };

    // Get unique dates sorted
    const getSortedDates = () => {
        const dates = [...new Set(filteredPosts.map(p => p.scheduled_date))];
        return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    };

    // Computed statistics
    const today = new Date().toISOString().split("T")[0];
    const stats = {
        total: posts.length,
        pending: posts.filter(p => p.status === "draft" || p.status === "queued").length,
        today: posts.filter(p => p.scheduled_date === today).length,
        monthlyRevenue: posts
            .filter(p => {
                const postDate = new Date(p.scheduled_date);
                const now = new Date();
                return postDate.getMonth() === now.getMonth() &&
                    postDate.getFullYear() === now.getFullYear();
            })
            .reduce((sum, p) => sum + p.total_price, 0),
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Antrian Posting</h1>
                    <p className="text-muted-foreground">
                        Kelola jadwal dan status postingan loker
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
                        <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button onClick={() => { setEditingPost(null); setFormOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Tambah
                    </Button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari perusahaan atau nomor WA..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-10"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as QueueStatus | "all")}>
                    <SelectTrigger className="w-[160px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="queued">Antrian</SelectItem>
                        <SelectItem value="posted">Posted</SelectItem>
                    </SelectContent>
                </Select>

                {/* View Mode Toggle */}
                <div className="bg-muted p-1 rounded-lg flex">
                    <Button
                        variant={viewMode === "kanban" && !showCalendar ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => { setViewMode("kanban"); setShowCalendar(false); }}
                        className="px-3"
                    >
                        <LayoutGrid className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Kanban</span>
                    </Button>
                    <Button
                        variant={viewMode === "list" && !showCalendar ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => { setViewMode("list"); setShowCalendar(false); }}
                        className="px-3"
                    >
                        <List className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">List</span>
                    </Button>
                    <Button
                        variant={showCalendar ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="px-3"
                    >
                        <CalendarDays className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Jadwal</span>
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Posting */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Total Posting</p>
                                    <p className="text-3xl font-bold mt-1">{stats.total}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <FileText className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Pending/Queued */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Menunggu</p>
                                    <p className="text-3xl font-bold mt-1">{stats.pending}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Clock className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Today's Posts */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Hari Ini</p>
                                    <p className="text-3xl font-bold mt-1">{stats.today}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <CalendarCheck className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Monthly Revenue */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Bulan Ini</p>
                                    <p className="text-2xl font-bold mt-1">{formatRupiah(stats.monthlyRevenue)}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Wallet className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Calendar/Schedule View */}
            {showCalendar && (
                <div className="space-y-4">
                    {getSortedDates().length === 0 ? (
                        <Card className="p-8 text-center text-muted-foreground">
                            <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Tidak ada posting terjadwal</p>
                        </Card>
                    ) : (
                        getSortedDates().map(date => (
                            <motion.div
                                key={date}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3 mb-3 pb-3 border-b">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                <CalendarDays className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-semibold">
                                                    {new Date(date).toLocaleDateString("id-ID", {
                                                        weekday: "long",
                                                        day: "numeric",
                                                        month: "long",
                                                        year: "numeric"
                                                    })}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {getPostsByDate()[date].length} posting
                                                </p>
                                            </div>
                                            {date === new Date().toISOString().split("T")[0] && (
                                                <Badge className="ml-auto bg-emerald-500">Hari Ini</Badge>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {getPostsByDate()[date].map(post => (
                                                <div
                                                    key={post.id}
                                                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                                                    onClick={() => handleEdit(post)}
                                                >
                                                    {post.poster_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={post.poster_url}
                                                            alt=""
                                                            className="w-12 h-12 rounded-lg object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                                                            <Upload className="w-4 h-4 text-muted-foreground/50" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">{post.company_name}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <Clock className="w-3 h-3" />
                                                            {formatTime(post.scheduled_time)}
                                                            <Badge variant="outline" className="text-[10px] px-1.5">
                                                                {getPackageName(post.package_id)}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold text-sm text-primary">
                                                            {formatRupiah(post.total_price)}
                                                        </p>
                                                        <Badge
                                                            className={`text-[10px] ${post.status === "posted"
                                                                ? "bg-emerald-500"
                                                                : post.status === "queued"
                                                                    ? "bg-amber-500"
                                                                    : "bg-slate-500"
                                                                }`}
                                                        >
                                                            {post.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* Kanban Board */}
            {viewMode === "kanban" && !showCalendar && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[calc(100vh-350px)]">
                    {columns.map((column) => (
                        <div
                            key={column.id}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(column.id)}
                            className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border/50"
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <h3 className={`font-semibold ${column.color}`}>{column.title}</h3>
                                    <Badge variant="secondary" className="px-1.5 min-w-6 justify-center">
                                        {getPostsByStatus(column.id).length}
                                    </Badge>
                                </div>
                            </div>

                            {/* Cards Container */}
                            <ScrollArea className="flex-1 -mx-4 px-4">
                                <div className="space-y-3 pb-4">
                                    <AnimatePresence mode="popLayout">
                                        {getPostsByStatus(column.id).map((post, index) => (
                                            <motion.div
                                                key={post.id}
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ delay: index * 0.05 }}
                                                draggable
                                                onDragStart={() => handleDragStart(post)}
                                                className={`cursor-grab active:cursor-grabbing ${draggedPost?.id === post.id ? "opacity-50" : ""}`}
                                            >
                                                <Card className="hover:shadow-md transition-shadow border-border overflow-hidden">
                                                    <CardContent className="p-0">
                                                        {/* Poster Thumbnail - smaller */}
                                                        <div className="aspect-[3/4] bg-muted relative">
                                                            {post.poster_url ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={post.poster_url}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Upload className="w-8 h-8 text-muted-foreground/30" />
                                                                </div>
                                                            )}
                                                            {/* Drag handle overlay */}
                                                            <div className="absolute top-2 right-2 p-1 bg-background/80 rounded">
                                                                <GripVertical className="w-4 h-4 text-muted-foreground" />
                                                            </div>
                                                            {/* Price badge on poster */}
                                                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-primary text-primary-foreground rounded-md text-sm font-bold shadow">
                                                                {formatRupiah(post.total_price)}
                                                            </div>
                                                        </div>

                                                        {/* Content */}
                                                        <div className="p-3">
                                                            {/* Company Name */}
                                                            <h4 className="font-semibold text-sm mb-2">{post.company_name}</h4>

                                                            {/* Info Grid */}
                                                            <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span>{post.whatsapp_number}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span>{formatDate(post.scheduled_date)}</span>
                                                                    <span className="text-muted-foreground/50">•</span>
                                                                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span>{formatTime(post.scheduled_time)}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Package className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="font-medium text-foreground">{getPackageName(post.package_id)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="flex items-center gap-1 pt-2 border-t">
                                                                {/* Quick Status Button */}
                                                                {getNextStatus(post.status) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="flex-1 h-8 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                                                        onClick={() => handleQuickStatusChange(post.id, getNextStatus(post.status)!)}
                                                                    >
                                                                        {post.status === "draft" ? (
                                                                            <><ArrowRight className="w-3.5 h-3.5 mr-1" /> Antri</>
                                                                        ) : post.status === "queued" ? (
                                                                            <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Posted</>
                                                                        ) : null}
                                                                    </Button>
                                                                )}
                                                                {post.status === "posted" && (
                                                                    <div className="flex-1 h-8 flex items-center justify-center text-emerald-600 text-xs font-medium">
                                                                        ✓ Selesai
                                                                    </div>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                                                    onClick={() => handleWhatsApp(post)}
                                                                >
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </Button>
                                                                {/* More Actions Dropdown */}
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                            <MoreVertical className="w-4 h-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={() => handleEdit(post)}>
                                                                            <Edit3 className="w-4 h-4 mr-2" /> Edit
                                                                        </DropdownMenuItem>
                                                                        {post.status !== "draft" && (
                                                                            <DropdownMenuItem onClick={() => handleQuickStatusChange(post.id, "draft")}>
                                                                                <FileText className="w-4 h-4 mr-2" /> Ke Draft
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {post.status !== "queued" && (
                                                                            <DropdownMenuItem onClick={() => handleQuickStatusChange(post.id, "queued")}>
                                                                                <Clock className="w-4 h-4 mr-2" /> Ke Antrian
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        {post.status !== "posted" && (
                                                                            <DropdownMenuItem onClick={() => handleQuickStatusChange(post.id, "posted")}>
                                                                                <CheckCircle2 className="w-4 h-4 mr-2" /> Tandai Posted
                                                                            </DropdownMenuItem>
                                                                        )}
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => handleCopyPosting(post)}>
                                                                            <Copy className="w-4 h-4 mr-2" /> Duplikat
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem
                                                                            onClick={() => setDeleteId(post.id)}
                                                                            className="text-destructive focus:text-destructive"
                                                                        >
                                                                            <Trash2 className="w-4 h-4 mr-2" /> Hapus
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {getPostsByStatus(column.id).length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed border-border rounded-lg bg-card/50">
                                            <GripVertical className="w-8 h-8 mb-2 opacity-20" />
                                            <p className="text-sm opacity-50">Kosong</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ))}
                </div>
            )
            }

            {/* List View */}
            {viewMode === "list" && !showCalendar && (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">Poster</TableHead>
                                <TableHead>Perusahaan</TableHead>
                                <TableHead>WhatsApp</TableHead>
                                <TableHead>Jadwal</TableHead>
                                <TableHead>Paket</TableHead>
                                <TableHead>Harga</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPosts.map((post) => (
                                <TableRow key={post.id}>
                                    <TableCell>
                                        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted">
                                            {post.poster_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={post.poster_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Upload className="w-4 h-4 text-muted-foreground/30" />
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{post.company_name}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-emerald-600 hover:text-emerald-700"
                                            onClick={() => handleWhatsApp(post)}
                                        >
                                            {post.whatsapp_number}
                                            <ExternalLink className="w-3 h-3 ml-1" />
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {formatDate(post.scheduled_date)} {formatTime(post.scheduled_time)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{getPackageName(post.package_id)}</Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold">{formatRupiah(post.total_price)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                post.status === "posted"
                                                    ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                                    : post.status === "queued"
                                                        ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                                        : "bg-slate-500/10 text-slate-500 hover:bg-slate-500/20"
                                            }
                                        >
                                            {post.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleEdit(post)}
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => setDeleteId(post.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {posts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Belum ada posting. Klik "Tambah Post" untuk memulai.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </Card>
            )
            }

            {/* Posting Form Dialog */}
            <PostingForm
                open={formOpen}
                onOpenChange={setFormOpen}
                packages={packages}
                addons={addons}
                editData={editingPost}
                onSuccess={loadData}
            />

            {/* Delete Confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Hapus Posting?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Posting ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                    </p>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Batal</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                        >
                            Hapus
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
