"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    LayoutDashboard,
    FileText,
    Plus,
    ListTodo,
    Database
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MobileNav() {
    const pathname = usePathname();

    const navItems = [
        { href: "/admin", icon: LayoutDashboard, label: "Home" },
        { href: "/admin/antri", icon: ListTodo, label: "Antri" },
        { href: "CENTER", icon: Plus, label: "Create" }, // Special center item
        { href: "/admin/database", icon: Database, label: "Database" },
        { href: "/admin/invoice", icon: FileText, label: "Invoice" },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
            {/* Glass Background */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)]" />

            <div className="relative flex items-center justify-around h-20 px-2 pb-2">
                {navItems.map((item, index) => {
                    const isActive = item.href !== "CENTER" && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)));

                    if (item.href === "CENTER") {
                        return (
                            <div key={index} className="relative -mt-8 group">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-violet-500 shadow-lg shadow-primary/30 flex items-center justify-center text-white ring-4 ring-background transition-transform duration-200 hover:scale-110 active:scale-95"
                                        >
                                            <Plus className="w-8 h-8" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" side="top" className="mb-2 w-48 bg-card/90 backdrop-blur-lg border-border/50">
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/invoice" className="cursor-pointer font-medium">
                                                <FileText className="mr-2 h-4 w-4 text-primary" />
                                                Buat Invoice
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link href="/admin/antri" className="cursor-pointer font-medium">
                                                <ListTodo className="mr-2 h-4 w-4 text-violet-500" />
                                                Tambah Antrian
                                            </Link>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        );
                    }

                    return (
                        <Link
                            key={index}
                            href={item.href}
                            className="flex-1 flex flex-col items-center justify-center py-2 h-full z-10 select-none"
                        >
                            <div className={cn(
                                "relative p-1.5 rounded-xl transition-all duration-300",
                                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                            )}>
                                <item.icon className={cn("w-6 h-6", isActive && "fill-current")} />

                                {/* Active Indicator Dot */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavIndicator"
                                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.3 }}
                                    />
                                )}
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium mt-1 transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
