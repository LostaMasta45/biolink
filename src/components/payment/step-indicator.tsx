"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
    currentStep: number;
    steps: { label: string; icon: string }[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2">
            {steps.map((step, idx) => {
                const stepNum = idx + 1;
                const isActive = stepNum === currentStep;
                const isCompleted = stepNum < currentStep;

                return (
                    <div key={idx} className="flex items-center gap-1.5 sm:gap-3">
                        {/* Step circle */}
                        <div className="flex flex-col items-center gap-1.5">
                            <div className={cn(
                                "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                                isCompleted
                                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                    : isActive
                                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-[3px] ring-primary/20"
                                        : "bg-muted/50 text-muted-foreground border border-border/50"
                            )}>
                                {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.icon}
                            </div>
                            <span className={cn(
                                "text-[10px] sm:text-[11px] font-semibold transition-colors",
                                isActive || isCompleted ? "text-primary" : "text-muted-foreground/60"
                            )}>
                                {step.label}
                            </span>
                        </div>

                        {/* Connector line */}
                        {idx < steps.length - 1 && (
                            <div className={cn(
                                "w-6 sm:w-12 h-[2px] rounded-full mb-5 transition-colors duration-300",
                                stepNum < currentStep ? "bg-primary/80" : "bg-border/40"
                            )} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
