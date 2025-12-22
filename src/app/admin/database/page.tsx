"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    Crown,
    TrendingUp,
    Wallet,
    Search,
    RefreshCw,
    Phone,
    Calendar,
    Package,
    X,
    MessageSquare,
    Copy,
    ExternalLink,
    Clock,
    Filter,
    LayoutGrid,
    List,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    getAggregatedClients,
    getClientDetail,
    getTierColor,
    getTierLabel,
    type ClientStats,
} from "@/lib/client-service";
import type { AggregatedClient, ClientDetail, ClientTier } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { generateWhatsAppLink } from "@/lib/posting-service";
import toast from "react-hot-toast";

export default function DatabasePage() {
    const [clients, setClients] = useState<AggregatedClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [tierFilter, setTierFilter] = useState<ClientTier | "all">("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // Detail modal
    const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);

    // Stats
    const [stats, setStats] = useState<ClientStats>({
        totalClients: 0,
        vipClients: 0,
        newThisMonth: 0,
        totalRevenue: 0,
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await getAggregatedClients();
            if (error) {
                toast.error(error);
            } else {
                setClients(data);
                // Calculate stats
                const now = new Date();
                const thisMonth = now.getMonth();
                const thisYear = now.getFullYear();
                setStats({
                    totalClients: data.length,
                    vipClients: data.filter(c => c.tier === "gold" || c.tier === "platinum").length,
                    newThisMonth: data.filter(c => {
                        const firstDate = new Date(c.first_posting_date);
                        return firstDate.getMonth() === thisMonth && firstDate.getFullYear() === thisYear;
                    }).length,
                    totalRevenue: data.reduce((sum, c) => sum + c.total_spent, 0),
                });
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenDetail = async (client: AggregatedClient) => {
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const { data, error } = await getClientDetail(client.whatsapp_number);
            if (error) {
                toast.error(error);
                setDetailOpen(false);
            } else {
                setSelectedClient(data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Gagal memuat detail");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleWhatsApp = (phone: string, companyName: string) => {
        const message = `Halo, saya dari Info Loker Jombang. Mengenai posting lowongan ${companyName}...`;
        window.open(generateWhatsAppLink(phone, message), "_blank");
    };

    const handleCopyNumber = (phone: string) => {
        navigator.clipboard.writeText(phone);
        toast.success("Nomor disalin!");
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    // Filter clients
    const filteredClients = clients.filter(client => {
        const matchesSearch = searchQuery === "" ||
            client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            client.whatsapp_number.includes(searchQuery);
        const matchesTier = tierFilter === "all" || client.tier === tierFilter;
        return matchesSearch && matchesTier;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Database Klien</h1>
                    <p className="text-muted-foreground">
                        Kelola dan lihat riwayat semua pemasang lowongan
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Total Klien</p>
                                    <p className="text-3xl font-bold mt-1">{stats.totalClients}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Users className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Klien VIP</p>
                                    <p className="text-3xl font-bold mt-1">{stats.vipClients}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Crown className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Baru Bulan Ini</p>
                                    <p className="text-3xl font-bold mt-1">{stats.newThisMonth}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/80">Total Revenue</p>
                                    <p className="text-2xl font-bold mt-1">{formatRupiah(stats.totalRevenue)}</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-xl">
                                    <Wallet className="w-6 h-6" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama perusahaan atau nomor WA..."
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

                <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as ClientTier | "all")}>
                    <SelectTrigger className="w-[160px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Tier</SelectItem>
                        <SelectItem value="platinum">Platinum</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="bronze">Bronze</SelectItem>
                    </SelectContent>
                </Select>

                <div className="bg-muted p-1 rounded-lg flex">
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="px-3"
                    >
                        <LayoutGrid className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Grid</span>
                    </Button>
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        className="px-3"
                    >
                        <List className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">List</span>
                    </Button>
                </div>
            </div>

            {/* Results Count */}
            <p className="text-sm text-muted-foreground">
                Menampilkan {filteredClients.length} dari {clients.length} klien
            </p>

            {/* Grid View */}
            {viewMode === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredClients.map((client, index) => {
                            const tierColors = getTierColor(client.tier);
                            return (
                                <motion.div
                                    key={client.whatsapp_number}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ delay: index * 0.03 }}
                                >
                                    <Card
                                        className="hover:shadow-lg transition-all cursor-pointer group border-border/50 overflow-hidden"
                                        onClick={() => handleOpenDetail(client)}
                                    >
                                        <CardContent className="p-0">
                                            {/* Poster Gallery Preview */}
                                            <div className="aspect-video bg-muted relative overflow-hidden">
                                                {client.poster_gallery.length > 0 ? (
                                                    <div className="flex h-full">
                                                        {client.poster_gallery.slice(0, 3).map((poster, i) => (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                key={i}
                                                                src={poster}
                                                                alt=""
                                                                className="h-full object-cover flex-1"
                                                                style={{ maxWidth: `${100 / Math.min(client.poster_gallery.length, 3)}%` }}
                                                            />
                                                        ))}
                                                        {client.poster_gallery.length > 3 && (
                                                            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white rounded text-xs font-medium">
                                                                +{client.poster_gallery.length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Package className="w-10 h-10 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                {/* Tier Badge */}
                                                <div className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-bold ${tierColors.bg} ${tierColors.text}`}>
                                                    {getTierLabel(client.tier)}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-4">
                                                <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                                                    {client.company_name}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    <span>{client.whatsapp_number}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                                    <div className="flex items-center gap-1">
                                                        <Badge variant="secondary" className="text-xs">
                                                            {client.total_postings} posting
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDate(client.last_posting_date)}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {filteredClients.length === 0 && !isLoading && (
                        <div className="col-span-full py-12 text-center text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Tidak ada klien ditemukan</p>
                        </div>
                    )}
                </div>
            )}

            {/* List View */}
            {viewMode === "list" && (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Perusahaan</TableHead>
                                <TableHead>WhatsApp</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead className="text-center">Posting</TableHead>
                                <TableHead>Total Spent</TableHead>
                                <TableHead>Terakhir</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClients.map((client) => {
                                const tierColors = getTierColor(client.tier);
                                return (
                                    <TableRow
                                        key={client.whatsapp_number}
                                        className="cursor-pointer"
                                        onClick={() => handleOpenDetail(client)}
                                    >
                                        <TableCell className="font-medium">{client.company_name}</TableCell>
                                        <TableCell>{client.whatsapp_number}</TableCell>
                                        <TableCell>
                                            <Badge className={`${tierColors.bg} ${tierColors.text} border-0`}>
                                                {getTierLabel(client.tier)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline">{client.total_postings}</Badge>
                                        </TableCell>
                                        <TableCell className="font-medium text-primary">
                                            {formatRupiah(client.total_spent)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(client.last_posting_date)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-emerald-600"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleWhatsApp(client.whatsapp_number, client.company_name);
                                                }}
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </Card>
            )}

            {/* Client Detail Modal */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            {selectedClient && (
                                <>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${getTierColor(selectedClient.tier).bg} ${getTierColor(selectedClient.tier).text}`}>
                                        {getTierLabel(selectedClient.tier)}
                                    </div>
                                    {selectedClient.company_name}
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {detailLoading ? (
                        <div className="py-12 flex items-center justify-center">
                            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : selectedClient ? (
                        <div className="flex-1 overflow-y-auto space-y-6">
                            {/* Client Info */}
                            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Phone className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">{selectedClient.whatsapp_number}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => handleCopyNumber(selectedClient.whatsapp_number)}
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Calendar className="w-4 h-4" />
                                        <span>Sejak {formatDate(selectedClient.first_posting_date)}</span>
                                    </div>
                                </div>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => handleWhatsApp(selectedClient.whatsapp_number, selectedClient.company_name)}
                                >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    WhatsApp
                                </Button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <Card className="bg-primary/5 border-primary/10">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Total Posting</p>
                                        <p className="text-3xl font-bold text-primary">{selectedClient.total_postings}</p>
                                    </CardContent>
                                </Card>
                                <Card className="bg-primary/5 border-primary/10">
                                    <CardContent className="p-4 text-center">
                                        <p className="text-sm text-muted-foreground">Total Spent</p>
                                        <p className="text-2xl font-bold text-primary">{formatRupiah(selectedClient.total_spent)}</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Poster Gallery */}
                            {selectedClient.poster_gallery.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-3">Galeri Poster ({selectedClient.poster_gallery.length})</h3>
                                    <ScrollArea className="w-full whitespace-nowrap">
                                        <div className="flex gap-3 pb-4">
                                            {selectedClient.poster_gallery.map((poster, i) => (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    key={i}
                                                    src={poster}
                                                    alt={`Poster ${i + 1}`}
                                                    className="w-40 h-56 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:ring-2 ring-primary transition-all"
                                                    onClick={() => window.open(poster, "_blank")}
                                                />
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </div>
                            )}

                            {/* Posting History */}
                            <div>
                                <h3 className="font-semibold mb-3">Riwayat Posting</h3>
                                <div className="space-y-2">
                                    {selectedClient.posting_history.map((post) => (
                                        <div
                                            key={post.id}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
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
                                                    <Package className="w-4 h-4 text-muted-foreground/50" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{post.company_name}</p>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatDate(post.scheduled_date)}
                                                    <span>•</span>
                                                    <Clock className="w-3 h-3" />
                                                    {post.scheduled_time?.substring(0, 5) || "10:00"}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm text-primary">
                                                    {formatRupiah(post.total_price)}
                                                </p>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] ${post.status === "posted"
                                                            ? "border-emerald-500 text-emerald-600"
                                                            : post.status === "queued"
                                                                ? "border-amber-500 text-amber-600"
                                                                : "border-slate-500 text-slate-600"
                                                        }`}
                                                >
                                                    {post.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}
