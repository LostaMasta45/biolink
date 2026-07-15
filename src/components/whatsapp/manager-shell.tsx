"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { WHATSAPP_NAV_ITEMS } from "@/constants/whatsapp-manager";
import { cn } from "@/lib/utils";

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-5 shadow-sm backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 p-2.5 text-white shadow-lg shadow-emerald-500/20">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">WhatsApp Automation Manager</h1>
            <p className="text-sm text-muted-foreground">Business control panel untuk konfigurasi Kirim.dev</p>
          </div>
        </div>
        <nav className="mt-5 flex gap-1 overflow-x-auto pb-1" aria-label="Navigasi WhatsApp Manager">
          {WHATSAPP_NAV_ITEMS.map((item) => {
            const active = item.href === "/admin/whatsapp" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}

