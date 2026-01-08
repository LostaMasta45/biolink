"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    FileText,
    Plus,
    ListTodo,
    Database,
    Wallet,
    Menu,
    Settings,
    LogOut,
    ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileNav() {
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    const navItems = [
        { href: "/admin", icon: LayoutDashboard, label: "Home" },
        { href: "/admin/keuangan", icon: Wallet, label: "Keuangan" },
        { href: "CENTER", icon: Plus, label: "Baru" },
        { href: "/admin/antri", icon: ListTodo, label: "Antrian" },
        { href: "MORE", icon: Menu, label: "Menu" },
    ];

    const isActive = (href: string) => {
        if (href === "/admin") return pathname === "/admin";
        return pathname.startsWith(href);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4,
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.8 },
        visible: { opacity: 1, scale: 1 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        >
            {/* Colorful Top Border Gradient */}
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            {/* Main Bar Background */}
            <div className="relative bg-background/95 backdrop-blur-xl border-t border-white/5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pb-safe-area">
                {/* Subtle Ambient Glow */}
                <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

                <div className="relative flex items-center justify-between px-2 h-16">
                    {navItems.map((item, index) => {
                        // CENTER BUTTON (ADD)
                        if (item.href === "CENTER") {
                            return (
                                <div key={index} className="relative -mt-10 group mx-2 z-10">
                                    {/* Glow Effect behind button */}
                                    <div className="absolute inset-1 bg-primary/40 rounded-full blur-md group-hover:blur-lg transition-all duration-300" />

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <motion.button
                                                variants={itemVariants}
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-violet-600 via-primary to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-primary/30 ring-4 ring-background"
                                            >
                                                <Plus className="w-7 h-7" />
                                            </motion.button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center" side="top" className="mb-4 w-60 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-border/50 shadow-2xl rounded-2xl p-2 animate-in slide-in-from-bottom-5">
                                            <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                                                Quick Actions
                                            </DropdownMenuLabel>

                                            <DropdownMenuItem asChild className="rounded-xl p-3 focus:bg-emerald-500/10 focus:text-emerald-600 cursor-pointer mb-1 group">
                                                <Link href="/admin/keuangan" className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                                                        <Wallet className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold block text-sm">Transaksi</span>
                                                        <span className="text-[10px] text-muted-foreground">Catat keuangan baru</span>
                                                    </div>
                                                </Link>
                                            </DropdownMenuItem>

                                            <DropdownMenuItem asChild className="rounded-xl p-3 focus:bg-violet-500/10 focus:text-violet-600 cursor-pointer mb-1 group">
                                                <Link href="/admin/antri" className="flex items-center gap-3">
                                                    <div className="p-2 bg-violet-100 dark:bg-violet-500/20 text-violet-600 rounded-lg group-hover:scale-110 transition-transform">
                                                        <ListTodo className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold block text-sm">Posting Loker</span>
                                                        <span className="text-[10px] text-muted-foreground">Tambah antrian job</span>
                                                    </div>
                                                </Link>
                                            </DropdownMenuItem>

                                            <DropdownMenuItem asChild className="rounded-xl p-3 focus:bg-amber-500/10 focus:text-amber-600 cursor-pointer group">
                                                <Link href="/admin/invoice" className="flex items-center gap-3">
                                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold block text-sm">Buat Invoice</span>
                                                        <span className="text-[10px] text-muted-foreground">Tagihan klien</span>
                                                    </div>
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            );
                        }

                        // MORE BUTTON (MENU)
                        if (item.href === "MORE") {
                            return (
                                <motion.div key={index} variants={itemVariants} className="flex-1">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <motion.button
                                                whileTap={{ scale: 0.9 }}
                                                className="w-full flex flex-col items-center justify-center gap-1 h-full pt-1 pb-1"
                                            >
                                                <div className="p-1 rounded-full transition-colors group-active:scale-95 text-muted-foreground/60 hover:text-foreground">
                                                    <Menu className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-medium text-muted-foreground/80">Menu</span>
                                            </motion.button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" side="top" className="mb-2 w-56 bg-background/95 backdrop-blur-xl border-border shadow-xl rounded-xl">
                                            <DropdownMenuLabel className="text-xs text-muted-foreground px-2">
                                                Lainnya
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/admin/database" className="flex items-center gap-2">
                                                    <Database className="w-4 h-4" /> Database
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link href="/admin/settings" className="flex items-center gap-2">
                                                    <Settings className="w-4 h-4" /> Pengaturan
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-500 focus:text-red-500 cursor-pointer">
                                                <LogOut className="w-4 h-4 mr-2" /> Logout
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </motion.div>
                            );
                        }

                        // REGULAR ITEMS
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className="flex-1 relative group h-full flex items-center justify-center"
                            >
                                <motion.div
                                    variants={itemVariants}
                                    whileTap={{ scale: 0.9 }}
                                    className="w-full flex flex-col items-center justify-center gap-1"
                                >
                                    {/* Simple Active Indicator Light */}
                                    {active && (
                                        <motion.div
                                            layoutId="activeLight"
                                            className="absolute top-0 w-12 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_2px_8px_rgba(var(--primary),0.5)]"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    )}

                                    <motion.div
                                        className={cn(
                                            "relative p-1.5 rounded-2xl transition-all duration-300",
                                            active
                                                ? "text-primary bg-primary/10"
                                                : "text-muted-foreground/60 hover:text-foreground"
                                        )}
                                        animate={{
                                            scale: active ? 1.05 : 1,
                                        }}
                                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    >
                                        <item.icon className={cn("w-5 h-5", active && "fill-primary/20")} />
                                    </motion.div>
                                    <motion.span
                                        className={cn(
                                            "text-[10px] font-medium block",
                                            active ? "text-primary" : "text-muted-foreground/70"
                                        )}
                                        animate={{ scale: active ? 1.05 : 1 }}
                                    >
                                        {item.label}
                                    </motion.span>
                                </motion.div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
