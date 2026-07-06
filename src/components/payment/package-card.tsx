"use client";

import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentPackageConfig } from "@/lib/payment-types";

interface PackageCardProps {
    pkg: PaymentPackageConfig;
    selected: boolean;
    onSelect: (id: number) => void;
}

export function PackageCard({ pkg, selected, onSelect }: PackageCardProps) {
    return (
        <>
            {/* Desktop View */}
            <motion.div
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(pkg.id)}
                className={cn(
                    "hidden md:block relative cursor-pointer rounded-2xl border p-4 transition-all duration-300 overflow-hidden",
                    pkg.isPopular 
                        ? "bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/40 dark:to-background shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)] hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)]" 
                        : "bg-card/60 backdrop-blur-md hover:shadow-xl dark:hover:shadow-primary/5",
                    selected
                        ? pkg.isPopular
                            ? "border-amber-500 ring-1 ring-amber-500/50 shadow-amber-500/20"
                            : "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary/30"
                        : pkg.isPopular
                            ? "border-amber-200 dark:border-amber-700/50 hover:border-amber-300 dark:hover:border-amber-600"
                            : "border-border/40 hover:border-border/80 dark:border-border/30"
                )}
            >
                {/* Background Gradient for Selected State */}
                {selected && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-30" />
                )}

                {/* Popular Badge */}
                {pkg.isPopular && (
                    <div className="absolute top-0 right-0 overflow-hidden rounded-bl-2xl">
                        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 bg-[length:200%_auto] text-white text-[10px] font-black tracking-wider py-1 px-4 shadow-sm">
                            POPULER
                        </div>
                    </div>
                )}

                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm",
                            pkg.isPopular 
                                ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" 
                                : "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary"
                        )}>
                            <span className="text-xl">{pkg.emoji}</span>
                        </div>
                        <div>
                            <h3 className="font-extrabold text-foreground tracking-tight text-lg leading-tight">
                                {pkg.name}
                            </h3>
                            <p className="text-xs text-muted-foreground font-medium mt-0.5">{pkg.duration}</p>
                        </div>
                    </div>
                    <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                        selected 
                            ? pkg.isPopular ? "border-amber-500 bg-amber-500" : "border-primary bg-primary" 
                            : "border-border bg-background"
                    )}>
                        <Check className={cn(
                            "w-3.5 h-3.5 transition-transform duration-300",
                            selected ? "scale-100 text-white" : "scale-0"
                        )} strokeWidth={3} />
                    </div>
                </div>

                <div className="mb-4">
                    {pkg.originalPrice && (
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-muted-foreground line-through opacity-70">
                                Rp {pkg.originalPrice.toLocaleString("id-ID")}
                            </span>
                        </div>
                    )}
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black text-foreground tracking-tight leading-none">
                            Rp {pkg.price.toLocaleString("id-ID")}
                        </span>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2.5">
                            <div className={cn(
                                "mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center",
                                pkg.isPopular ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" : "bg-primary/10 dark:bg-primary/20 text-primary"
                            )}>
                                <Star className="w-2.5 h-2.5 fill-current" />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground leading-snug">{feature}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Mobile View */}
            <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(pkg.id)}
                className={cn(
                    "md:hidden relative cursor-pointer rounded-3xl p-4 transition-all duration-300 flex items-start gap-4",
                    pkg.isPopular && !selected && "border-[2px] border-amber-300/50 bg-gradient-to-br from-amber-50 to-orange-50/30 shadow-[0_4px_15px_rgba(245,158,11,0.1)]",
                    selected
                        ? "border-[2px] border-[#0b411d] shadow-[0_8px_24px_-8px_rgba(11,65,29,0.25)] bg-[#0b411d]/[0.02]"
                        : !pkg.isPopular && "border-[2px] border-transparent bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
                )}
            >
                {/* Icon Container */}
                <div className={cn(
                    "w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 transition-colors",
                    selected 
                        ? pkg.isPopular ? "bg-amber-100 text-amber-600" : "bg-[#0b411d] text-white shadow-lg shadow-[#0b411d]/30" 
                        : "bg-slate-50 text-slate-400 border border-slate-100"
                )}>
                    <span className="text-2xl">{pkg.emoji}</span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className={cn("font-bold text-[15px]", selected ? "text-[#0b411d]" : "text-slate-700")}>{pkg.name}</h3>
                        {pkg.isPopular && (
                            <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">Premium</span>
                        )}
                    </div>
                    <div className="flex flex-col mt-0.5">
                        <span className="font-black text-[#9a181e] text-[15px]">Rp {pkg.price.toLocaleString("id-ID")}</span>
                        <div className="flex flex-col gap-1 mt-1.5">
                            {pkg.features.map((feature, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                                    <span className="text-[12px] text-slate-500 font-medium leading-snug">
                                        {feature}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Checkmark circle */}
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0 transition-all",
                    selected ? "border-[#0b411d] bg-[#0b411d] scale-110" : "border-slate-200 bg-slate-50"
                )}>
                    {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                </div>
            </motion.div>
        </>
    );
}
