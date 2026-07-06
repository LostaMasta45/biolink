"use client";

import { cn } from "@/lib/utils";
import type { PaymentAddonConfig } from "@/lib/payment-types";

interface AddonToggleProps {
    addon: PaymentAddonConfig;
    selected: boolean;
    onToggle: (id: number) => void;
}

export function AddonToggle({ addon, selected, onToggle }: AddonToggleProps) {
    return (
        <>
            {/* Desktop View */}
            <button
                type="button"
                onClick={() => onToggle(addon.id)}
                className={cn(
                    "hidden md:flex w-full items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 text-left",
                    "bg-card/40 backdrop-blur-md hover:shadow-sm dark:hover:shadow-primary/5",
                    selected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border/40 hover:border-border/80 dark:border-border/30"
                )}
            >
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-sm",
                    selected ? "bg-primary/20 dark:bg-primary/30" : "bg-muted dark:bg-muted/30"
                )}>
                    <span className="text-lg">{addon.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "font-bold text-[13px] truncate leading-tight tracking-tight",
                        selected ? "text-primary dark:text-primary" : "text-foreground"
                    )}>
                        {addon.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate font-medium">{addon.description}</p>
                </div>
                <div className="shrink-0 text-right flex items-center gap-2">
                    <p className={cn(
                        "font-extrabold text-[13px] tracking-tight",
                        selected ? "text-primary dark:text-primary" : "text-foreground"
                    )}>
                        +{(addon.price / 1000).toFixed(0)}k
                    </p>
                    {/* Toggle switch */}
                    <div className={cn(
                        "w-8 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center",
                        selected ? "bg-primary" : "bg-muted-foreground/30 dark:bg-muted/50"
                    )}>
                        <div className={cn(
                            "w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                            selected ? "translate-x-3" : "translate-x-0"
                        )} />
                    </div>
                </div>
            </button>

            {/* Mobile View */}
            <button
                type="button"
                onClick={() => onToggle(addon.id)}
                className={cn(
                    "md:hidden w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 text-left",
                    selected
                        ? "border-[2px] border-[#0b411d] shadow-[0_8px_24px_-8px_rgba(11,65,29,0.2)] bg-[#0b411d]/[0.02]"
                        : "border-[2px] border-transparent bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                )}
            >
                <div className={cn(
                    "w-10 h-10 rounded-[0.8rem] flex items-center justify-center shrink-0 transition-colors",
                    selected ? "bg-[#0b411d] text-white shadow-md shadow-[#0b411d]/20" : "bg-slate-50 text-slate-400 border border-slate-100"
                )}>
                    <span className="text-xl">{addon.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className={cn("font-bold text-[14px] truncate", selected ? "text-[#0b411d]" : "text-slate-700")}>
                        {addon.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{addon.description}</p>
                </div>
                <div className="shrink-0 text-right flex items-center gap-3">
                    <p className="font-black text-[#9a181e] text-[13px]">
                        +{(addon.price / 1000).toFixed(0)}k
                    </p>
                    {/* Toggle switch */}
                    <div className={cn(
                        "w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center",
                        selected ? "bg-[#0b411d]" : "bg-slate-200"
                    )}>
                        <div className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
                            selected ? "translate-x-4" : "translate-x-0"
                        )} />
                    </div>
                </div>
            </button>
        </>
    );
}
