"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Download, Send, File, FileImage, X, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileInvoiceActionBarProps {
    onSave: () => void;
    onDownload: (format: "pdf" | "png" | "jpeg") => void;
    onShare: () => void;
    isSaving: boolean;
}

export function MobileInvoiceActionBar({
    onSave,
    onDownload,
    onShare,
    isSaving,
}: MobileInvoiceActionBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const toggleMenu = () => setIsOpen(!isOpen);

    const menuVariants = {
        hidden: { opacity: 0, y: 20, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 10, scale: 0.95 },
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed bottom-[90px] left-0 right-0 z-[100] px-4 flex justify-center pointer-events-none md:hidden font-sans">
            <div className="pointer-events-auto relative">
                {/* Secondary Actions (Expandable Menu) */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={menuVariants}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-full mb-3 left-0 right-0 bg-background/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-2 w-full flex flex-col gap-2 min-w-[300px]"
                        >
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        onDownload("pdf");
                                        setIsOpen(false);
                                    }}
                                    className="h-12 justify-start rounded-xl"
                                >
                                    <File className="mr-2 h-4 w-4 text-red-500" />
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        onDownload("png");
                                        setIsOpen(false);
                                    }}
                                    className="h-12 justify-start rounded-xl"
                                >
                                    <FileImage className="mr-2 h-4 w-4 text-blue-500" />
                                    Image
                                </Button>
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    onSave();
                                    setIsOpen(false);
                                }}
                                disabled={isSaving}
                                className="h-12 w-full rounded-xl justify-between px-4 bg-secondary/50 hover:bg-secondary/70"
                            >
                                <div className="flex items-center">
                                    <Save className="mr-2 h-4 w-4 text-foreground/70" />
                                    Simpan Draft
                                </div>
                                {isSaving && <span className="animate-spin">⏳</span>}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Primary Bar */}
                <motion.div
                    className="flex items-center gap-2 p-2 bg-foreground text-background rounded-full shadow-2xl shadow-black/20"
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                    {/* Menu Toggle */}
                    <button
                        onClick={toggleMenu}
                        className={cn(
                            "h-12 w-12 rounded-full flex items-center justify-center transition-all active:scale-95",
                            isOpen ? "bg-background text-foreground" : "bg-background/10 hover:bg-background/20 text-background"
                        )}
                    >
                        {isOpen ? <X className="h-5 w-5" /> : <MoreVertical className="h-5 w-5" />}
                    </button>

                    {/* Main CTA: Share WhatsApp */}
                    <Button
                        onClick={onShare}
                        className="h-12 px-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-base shadow-lg shadow-emerald-500/20 flex-1"
                    >
                        <Send className="mr-2 h-5 w-5" />
                        WhatsApp
                    </Button>
                </motion.div>
            </div>
        </div>,
        document.body
    );
}
