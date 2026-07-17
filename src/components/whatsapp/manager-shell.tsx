"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Inbox, MessageSquareText } from "lucide-react";

export function ManagerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOverview = pathname === "/admin/whatsapp";
  return (
    <div className="whatsapp-workspace min-w-0 space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-primary to-transparent" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">WhatsApp workspace</p>
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{isOverview ? "Automation Manager" : "WhatsApp Automation"}</h1>
              <p className="truncate text-sm text-muted-foreground">Gunakan menu WhatsApp di sidebar untuk berpindah fitur.</p>
            </div>
          </div>
          <Link href="/admin/inbox" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
            <Inbox className="h-4 w-4 text-emerald-600" /> Buka Inbox
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
