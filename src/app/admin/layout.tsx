"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Link as LinkIcon,
    FileText,
    ListTodo,
    Wallet,
    LogOut,
    Menu,
    ChevronRight,
    Settings,
    Bell,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/admin/mobile-nav";
import { ModeToggle } from "@/components/mode-toggle";

const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/invoice", icon: FileText, label: "Invoice" },
    { href: "/admin/antri", icon: ListTodo, label: "Antrian Posting" },
    { href: "/admin/keuangan", icon: Wallet, label: "Keuangan" },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        toast.success("Berhasil logout");
        router.push("/login");
        router.refresh();
    };

    return (
        <div className="min-h-screen bg-background flex flex-col lg:flex-row">
            {/* Desktop Sidebar (Hidden on Mobile) */}
            <aside className="hidden lg:flex fixed top-0 left-0 z-50 h-screen w-72 bg-card border-r border-border flex-col">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-border">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                            <span className="text-white font-bold text-xs">ILJ</span>
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground leading-none">
                                ILJ Admin
                            </h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Dashboard
                            </p>
                        </div>
                    </Link>
                </div>

                {/* User Info */}
                <div className="p-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 shadow-sm">
                        <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src="/profile.png" />
                            <AvatarFallback className="bg-primary/10 text-primary">A</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Admin ILJ</p>
                            <p className="text-xs text-muted-foreground truncate">
                                admin@infoloker.com
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 px-4">
                    <div className="space-y-1 py-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                >
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        className={cn(
                                            "w-full justify-start h-11 mb-1 font-medium",
                                            isActive
                                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                        )}
                                    >
                                        <Icon className={cn("w-4 h-4 mr-3", isActive && "text-primary")} />
                                        {item.label}
                                        {isActive && (
                                            <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
                                        )}
                                    </Button>
                                </Link>
                            );
                        })}
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-1">
                        <p className="px-4 text-xs font-medium text-muted-foreground mb-2">
                            System
                        </p>
                        <Button variant="ghost" className="w-full justify-start h-9 text-muted-foreground">
                            <Settings className="w-4 h-4 mr-3" />
                            Settings
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-3" />
                            Logout
                        </Button>
                    </div>
                </ScrollArea>
            </aside>

            {/* Mobile Navigation (Visible only on Mobile) */}
            <MobileNav />

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen lg:pl-72 transition-all duration-300">
                {/* Desktop Header (Hidden on Mobile) */}
                <header className="sticky top-0 z-40 w-full h-16 bg-background/80 backdrop-blur-md border-b border-border hidden lg:flex items-center justify-between px-8">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center text-sm text-muted-foreground">
                            <span className="hover:text-foreground cursor-pointer transition-colors">Admin</span>
                            <ChevronRight className="w-4 h-4 mx-2" />
                            <span className="font-medium text-foreground capitalize">
                                {pathname.split("/").pop() || "Dashboard"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"></span>
                        </Button>
                    </div>
                </header>

                {/* Mobile Header (Simplified) */}
                <header className="sticky top-0 z-40 w-full h-14 bg-background/80 backdrop-blur-md border-b border-border flex lg:hidden items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
                            <span className="text-white font-bold text-xs">ILJ</span>
                        </div>
                        <span className="font-bold text-lg">Admin</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-8 pb-32 lg:pb-8 overflow-x-hidden">
                    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
