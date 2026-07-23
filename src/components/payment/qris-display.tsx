"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCcw, Loader2, CheckCircle2, XCircle, Wallet, Instagram, ShieldCheck, Download, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";

interface QrisDisplayProps {
    orderId: string;
    accessToken: string;
    totalAmount: number;
    qrisImage: string | null;
    qrisUrl: string | null;
    expiredAt: string;
    onPaymentSuccess: () => void;
    onPaymentExpired: () => void;
    onBack?: () => void;
}

export function QrisDisplay({
    orderId,
    accessToken,
    totalAmount,
    qrisImage,
    qrisUrl,
    expiredAt,
    onPaymentSuccess,
    onPaymentExpired,
    onBack,
}: QrisDisplayProps) {
    const [status, setStatus] = useState<"PENDING" | "PAID" | "EXPIRED">("PENDING");
    const [timeLeft, setTimeLeft] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    const statusRef = useRef(status);
    const terminalStateRef = useRef<"PAID" | "EXPIRED" | null>(null);
    const requestInFlightRef = useRef(false);
    const checkStatusRef = useRef<() => void>(() => undefined);
    const desktopQrRef = useRef<HTMLDivElement>(null);
    const mobileQrRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        const qrElement = [desktopQrRef.current, mobileQrRef.current]
            .find((element) => element && element.getBoundingClientRect().width > 0);
        if (!qrElement) return;
        setIsDownloading(true);
        const toastId = toast.loading("Mendownload QR Code...");
        
        try {
            await new Promise(r => setTimeout(r, 200));
            // Capture only the QR holder, not the branded payment card, timer,
            // instructions, or download button. The white background keeps the
            // exported QR reliably scannable on every device.
            const dataUrl = await toPng(qrElement, {
                pixelRatio: 4,
                filter: (node) => {
                    if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true") {
                        return false;
                    }
                    return true;
                },
                backgroundColor: '#ffffff'
            });
            
            const link = document.createElement("a");
            link.download = `QR-Pembayaran-${orderId}.png`;
            link.href = dataUrl;
            link.click();
            toast.success("Berhasil didownload!", { id: toastId });
        } catch (error) {
            console.error("Failed to download QR", error);
            toast.error("Gagal mendownload gambar", { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    const setPaymentStatus = useCallback((nextStatus: "PENDING" | "PAID" | "EXPIRED") => {
        statusRef.current = nextStatus;
        setStatus(nextStatus);
    }, []);

    const finishPaid = useCallback(() => {
        if (terminalStateRef.current) return;
        terminalStateRef.current = "PAID";
        setPaymentStatus("PAID");
        onPaymentSuccess();
    }, [onPaymentSuccess, setPaymentStatus]);

    const finishExpired = useCallback(() => {
        if (terminalStateRef.current) return;
        terminalStateRef.current = "EXPIRED";
        setPaymentStatus("EXPIRED");
        onPaymentExpired();
    }, [onPaymentExpired, setPaymentStatus]);

    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Countdown timer. It never decides expiry by itself; the server status
    // endpoint gets the final say, which prevents a late local timer from
    // overriding a successful payment.
    useEffect(() => {
        if (status !== "PENDING") return;

        const tick = () => {
            if (statusRef.current !== "PENDING" || terminalStateRef.current) return;

            const now = new Date().getTime();
            const expiry = new Date(expiredAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
                checkStatusRef.current();
                return;
            }

            const totalSeconds = Math.floor(diff / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hours > 0) {
                setTimeLeft(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
            } else {
                setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
            }
        };

        tick();
        const timer = setInterval(() => {
            tick();
        }, 1000);

        return () => clearInterval(timer);
    }, [expiredAt, status]);

    // Poll the server periodically while the order is pending.
    const checkStatus = useCallback(async () => {
        if (statusRef.current !== "PENDING" || terminalStateRef.current || requestInFlightRef.current) return;
        requestInFlightRef.current = true;
        setIsChecking(true);
        try {
            const res = await fetch(`/api/payment/status/${orderId}?token=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
            const data = await res.json();
            if (data.success && data.data) {
                const serverStatus = String(data.data.status || "").toUpperCase();
                if (serverStatus === "PAID") {
                    finishPaid();
                } else if (serverStatus === "EXPIRED") {
                    finishExpired();
                }
            }
        } catch {
            // silently fail
        } finally {
            requestInFlightRef.current = false;
            setIsChecking(false);
        }
    }, [orderId, accessToken, finishExpired, finishPaid]);

    useEffect(() => {
        checkStatusRef.current = () => { void checkStatus(); };
    }, [checkStatus]);

    useEffect(() => {
        if (status !== "PENDING") return;
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") void checkStatus();
        }, 7000);
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void checkStatus();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [checkStatus, status]);

    const qrSrc = qrisImage || qrisUrl || "";

    return (
        <>
            {/* Desktop View */}
            <div className="hidden md:flex flex-col items-center">
                {/* Status Header */}
                <AnimatePresence mode="wait">
                    {status === "PENDING" && (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20"
                        >
                            <div className="relative">
                                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                            </div>
                            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                Menunggu Pembayaran...
                            </span>
                            {isChecking && (
                                <RefreshCcw className="w-3 h-3 text-amber-400 animate-spin" />
                            )}
                        </motion.div>
                    )}
                    {status === "PAID" && (
                        <motion.div
                            key="paid"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                Pembayaran Berhasil! ✅
                            </span>
                        </motion.div>
                    )}
                    {status === "EXPIRED" && (
                        <motion.div
                            key="expired"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20"
                        >
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                Pembayaran Expired
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* QR Code Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                        "w-full max-w-sm mx-auto h-full rounded-[2rem] p-1 relative overflow-hidden shadow-xl flex flex-col mb-6",
                        status === "PAID"
                            ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25"
                            : status === "EXPIRED"
                                ? "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/25"
                                : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-purple-500/25"
                    )}
                >
                    <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                        {/* Decorative backgrounds */}
                        <div className={cn(
                            "absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full -mr-4 -mt-4",
                            status === "PAID" ? "bg-gradient-to-br from-emerald-400 to-emerald-600" :
                            status === "EXPIRED" ? "bg-gradient-to-br from-red-400 to-red-600" :
                            "bg-gradient-to-br from-indigo-500 to-purple-500"
                        )}></div>
                        <div className={cn(
                            "absolute bottom-0 left-0 w-40 h-40 opacity-10 rounded-tr-full -ml-8 -mb-8",
                            status === "PAID" ? "bg-gradient-to-tr from-emerald-600 to-emerald-400" :
                            status === "EXPIRED" ? "bg-gradient-to-tr from-red-600 to-red-400" :
                            "bg-gradient-to-tr from-pink-500 to-purple-500"
                        )}></div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                            {/* Icon */}
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shrink-0",
                                status === "PAID" ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25" :
                                status === "EXPIRED" ? "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/25" :
                                "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-purple-500/25"
                            )}>
                                {status === "PAID" ? <CheckCircle2 className="w-5 h-5" /> : 
                                 status === "EXPIRED" ? <XCircle className="w-5 h-5" /> :
                                 <Wallet className="w-5 h-5" />}
                            </div>
                            
                            {/* Heading */}
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                Scan Untuk <span className={cn(
                                    "bg-clip-text text-transparent bg-gradient-to-r",
                                    status === "PAID" ? "from-emerald-400 to-emerald-600" :
                                    status === "EXPIRED" ? "from-red-400 to-red-600" :
                                    "from-indigo-500 via-purple-500 to-pink-500"
                                )}>Membayar</span>
                            </h2>
                            
                            {/* QR Image */}
                            <div className={cn(
                                "p-1 rounded-[1.3rem] shadow-xl w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0",
                                status === "PAID" ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25" :
                                status === "EXPIRED" ? "bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/25" :
                                "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-purple-500/25"
                            )}>
                                <div ref={desktopQrRef} className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center relative">
                                    {qrSrc ? (
                                        <img
                                            src={qrSrc}
                                            alt="QRIS Payment"
                                            className={cn(
                                                "w-full h-full object-contain rounded-lg",
                                                status !== "PENDING" && "opacity-30 blur-sm"
                                            )}
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-lg bg-muted flex items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                    
                                    {/* Overlay for PAID */}
                                    {status === "PAID" && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="absolute inset-0 flex items-center justify-center"
                                        >
                                            <div className="bg-emerald-500 rounded-full p-4 shadow-2xl shadow-emerald-500/50">
                                                <CheckCircle2 className="w-16 h-16 text-white" />
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Overlay for EXPIRED */}
                                    {status === "EXPIRED" && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="absolute inset-0 flex items-center justify-center"
                                        >
                                            <div className="bg-red-500 rounded-full p-4 shadow-2xl shadow-red-500/50">
                                                <XCircle className="w-16 h-16 text-white" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Brand Footer */}
                        <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">infolokerjombang</h3>
                            <div className={cn(
                                "flex items-center justify-center gap-1.5 mt-1",
                                status === "PAID" ? "text-emerald-600 dark:text-emerald-400" :
                                status === "EXPIRED" ? "text-red-600 dark:text-red-400" :
                                "text-pink-600 dark:text-pink-400"
                            )}>
                                <Instagram className="w-4 h-4" />
                                <span className="text-sm font-semibold tracking-wide truncate">@infolokerjombang</span>
                            </div>
                        </div>
                        
                        {/* Download Button (Ignored by html2canvas) */}
                        <button
                            data-html2canvas-ignore="true"
                            onClick={handleDownload}
                            disabled={isDownloading || status !== "PENDING"}
                            title="Download QR"
                            className="absolute bottom-4 right-4 p-2.5 bg-slate-900/50 hover:bg-slate-900/80 backdrop-blur-md text-white rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-0 disabled:pointer-events-none z-50 flex items-center justify-center group/btn"
                        >
                            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover/btn:-translate-y-0.5 transition-transform" />}
                        </button>
                    </div>
                </motion.div>

                {/* Amount Display */}
                <div className="w-full max-w-sm mx-auto mb-6 bg-white dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Total Pembayaran</p>
                    <div className="flex items-start gap-1">
                        <span className="text-lg font-bold text-slate-900 dark:text-white mt-1">Rp</span>
                        <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                            {totalAmount.toLocaleString("id-ID")}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Nominal unik agar otomatis diverifikasi
                        </p>
                    </div>
                </div>

                {/* Timer */}
                {status === "PENDING" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border"
                    >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Berlaku</span>
                        <span className={cn(
                            "text-lg font-mono font-bold",
                            parseInt(timeLeft.split(":")[0]) < 5 ? "text-red-500" : "text-foreground"
                        )}>
                            {timeLeft}
                        </span>
                    </motion.div>
                )}

                {/* Order ID */}
                <p className="text-xs text-muted-foreground mt-3 font-mono">
                    Order: {orderId}
                </p>
            </div>

            {/* Mobile View */}
            {/* Mobile Native View (Full Screen - Green E-Wallet Style) */}
            <div className="flex md:hidden fixed inset-0 z-[100] h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#00a550] flex-col font-sans">
                {/* Header (Diabaikan saat download) */}
                <div className="flex items-center justify-center px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 text-white relative z-10 shrink-0 min-h-[60px]" data-html2canvas-ignore="true">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="absolute left-4 w-10 h-10 flex shrink-0 items-center justify-center bg-white/20 backdrop-blur-md rounded-full transition-all active:scale-95 z-20"
                            aria-label="Kembali"
                        >
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </button>
                    )}
                    
                    <div className="flex items-center justify-center gap-2 overflow-hidden px-14 w-full">
                        {status === "PENDING" && (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                                <span className="font-bold text-base sm:text-[17px] leading-tight truncate">Menunggu Pembayaran</span>
                            </>
                        )}
                        {status === "PAID" && (
                            <>
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span className="font-bold text-base sm:text-[17px] leading-tight truncate">Pembayaran Berhasil</span>
                            </>
                        )}
                        {status === "EXPIRED" && (
                            <>
                                <XCircle className="w-5 h-5 shrink-0" />
                                <span className="font-bold text-base sm:text-[17px] leading-tight truncate">Pembayaran Kadaluarsa</span>
                            </>
                        )}
                    </div>
                </div>
                
                {/* Timer Display */}
                {status === "PENDING" && (
                    <div className="text-center text-white/90 text-xs sm:text-sm font-medium mb-3 shrink-0 z-10" data-html2canvas-ignore="true">
                        Selesaikan dalam <span className="font-bold font-mono text-sm sm:text-base">{timeLeft}</span>
                    </div>
                )}
                
                {/* Floating Content Card Container */}
                <div className="min-h-0 flex-1 flex flex-col relative mt-7 sm:mt-9 w-full max-w-[500px] mx-auto">
                    {/* Floating Avatar */}
                    <div className="absolute -top-8 sm:-top-10 left-1/2 -translate-x-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full p-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.08)] z-20 shrink-0">
                        <div className="w-full h-full bg-slate-50 rounded-full overflow-hidden flex items-center justify-center border border-slate-100">
                            <img src="/logo-infoloker.png" alt="Logo" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                    </div>
                    
                    {/* Scrollable Content inside Card */}
                    <div className="flex-1 overflow-y-auto overscroll-contain bg-white rounded-t-[28px] sm:rounded-t-[32px] pt-10 sm:pt-14 px-5 sm:px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col items-center relative shadow-[0_-10px_20px_rgba(0,0,0,0.1)] z-10 w-full">
                        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-1 tracking-tight">infolokerjombang</h2>
                        <p className="text-slate-600 text-sm font-semibold mb-5 sm:mb-6 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">Rp {totalAmount.toLocaleString("id-ID")}</p>
                        
                        <div ref={mobileQrRef} className="w-full max-w-[260px] aspect-square flex items-center justify-center p-3 sm:p-4 rounded-[28px] border-2 border-slate-100 bg-white mb-5 sm:mb-6 shadow-sm relative overflow-hidden shrink-0">
                            {qrSrc ? (
                                <img
                                    src={qrSrc}
                                    alt="QRIS Payment"
                                    className={cn(
                                        "w-full h-full object-contain rounded-xl",
                                        status !== "PENDING" && "opacity-30 blur-sm"
                                    )}
                                />
                            ) : (
                                <div className="w-full h-full rounded-xl bg-slate-50 flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#00a550]" />
                                </div>
                            )}
                            
                            {status === "PAID" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                    <div className="bg-emerald-500 rounded-full p-3.5 shadow-xl shadow-emerald-500/50">
                                        <CheckCircle2 className="w-10 h-10 text-white" />
                                    </div>
                                </div>
                            )}
                            {status === "EXPIRED" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                    <div className="bg-red-500 rounded-full p-3.5 shadow-xl shadow-red-500/50">
                                        <XCircle className="w-10 h-10 text-white" />
                                    </div>
                                </div>
                            )}
                        </div>

                    {/* Penjelasan / Instruksi Scan (Collapsible Accordion for Single-Screen View) */}
                    <div className="w-full bg-emerald-50/90 rounded-2xl border border-emerald-100/80 shrink-0 mb-3 overflow-hidden transition-all">
                        <button 
                            type="button"
                            onClick={() => setShowInstructions(!showInstructions)}
                            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left focus:outline-none"
                        >
                            <span className="text-emerald-900 font-bold text-xs sm:text-sm flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-emerald-200/80 rounded-full flex items-center justify-center text-emerald-800 text-[10px]">ℹ</span>
                                Cara Pembayaran
                            </span>
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                                {showInstructions ? "Tutup" : "Petunjuk"}
                                {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                        </button>
                        
                        <AnimatePresence>
                            {showInstructions && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden border-t border-emerald-100/60"
                                >
                                    <ol className="p-3.5 pt-2 text-emerald-800/80 text-[11px] space-y-1.5 font-medium leading-relaxed">
                                        <li className="flex gap-1.5">
                                            <span className="font-bold">1.</span>
                                            <span>Buka aplikasi e-Wallet atau M-Banking (Gopay, OVO, BCA, dll).</span>
                                        </li>
                                        <li className="flex gap-1.5">
                                            <span className="font-bold">2.</span>
                                            <span>Pilih opsi <strong>Scan QRIS</strong>.</span>
                                        </li>
                                        <li className="flex gap-1.5">
                                            <span className="font-bold">3.</span>
                                            <span>Arahkan kamera ke QR Code di atas atau upload dari galeri.</span>
                                        </li>
                                        <li className="flex gap-1.5">
                                            <span className="font-bold">4.</span>
                                            <span>Pastikan nama merchant: <strong>infolokerjombang</strong>.</span>
                                        </li>
                                    </ol>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    
                    {/* Tombol Simpan */}
                    <button 
                        data-html2canvas-ignore="true"
                        onClick={handleDownload}
                        disabled={isDownloading || status !== "PENDING"}
                        className="w-full bg-[#00a550] hover:bg-[#008c44] text-white py-3 sm:py-3.5 rounded-[18px] sm:rounded-[20px] font-bold text-sm flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none shrink-0"
                    >
                        {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                        {isDownloading ? "Menyimpan QR..." : "Simpan QR Code"}
                    </button>
                </div>
            </div>
            </div>
        </>
    );
}
