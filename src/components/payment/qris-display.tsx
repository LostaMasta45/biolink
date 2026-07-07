"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, RefreshCcw, Loader2, CheckCircle2, XCircle, Wallet, Instagram, ShieldCheck, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";

interface QrisDisplayProps {
    orderId: string;
    totalAmount: number;
    qrisImage: string | null;
    qrisUrl: string | null;
    expiredAt: string;
    onPaymentSuccess: () => void;
    onPaymentExpired: () => void;
}

export function QrisDisplay({
    orderId,
    totalAmount,
    qrisImage,
    qrisUrl,
    expiredAt,
    onPaymentSuccess,
    onPaymentExpired,
}: QrisDisplayProps) {
    const [status, setStatus] = useState<"PENDING" | "PAID" | "EXPIRED">("PENDING");
    const [timeLeft, setTimeLeft] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        const toastId = toast.loading("Mendownload QR Code...");
        
        try {
            await new Promise(r => setTimeout(r, 200));
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 4,
                filter: (node) => {
                    if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true") {
                        return false;
                    }
                    return true;
                },
                backgroundColor: 'transparent'
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

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const expiry = new Date(expiredAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft("00:00");
                setStatus("EXPIRED");
                onPaymentExpired();
                clearInterval(timer);
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
        }, 1000);

        return () => clearInterval(timer);
    }, [expiredAt, onPaymentExpired]);

    // Poll status every 1 second
    const checkStatus = useCallback(async () => {
        if (status !== "PENDING") return;
        setIsChecking(true);
        try {
            const res = await fetch(`/api/payment/status/${orderId}`, { cache: "no-store" });
            const data = await res.json();
            if (data.success && data.data) {
                if (data.data.status === "PAID") {
                    setStatus("PAID");
                    onPaymentSuccess();
                } else if (data.data.status === "EXPIRED") {
                    setStatus("EXPIRED");
                    onPaymentExpired();
                }
            }
        } catch {
            // silently fail
        } finally {
            setIsChecking(false);
        }
    }, [orderId, status, onPaymentSuccess, onPaymentExpired]);

    useEffect(() => {
        if (status !== "PENDING") return;
        const interval = setInterval(checkStatus, 1000);
        return () => clearInterval(interval);
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
                    ref={cardRef}
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
                                <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center relative">
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
            <div className="flex md:hidden fixed inset-0 z-[100] bg-[#00a550] flex-col font-sans">
                {/* Header (Diabaikan saat download) */}
                <div className="flex justify-between items-center px-6 pt-12 pb-6 text-white relative z-10" data-html2canvas-ignore="true">
                    <div className="flex items-center gap-3">
                        {status === "PENDING" && (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="font-bold text-lg">Menunggu Pembayaran</span>
                            </>
                        )}
                        {status === "PAID" && (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-bold text-lg">Pembayaran Berhasil</span>
                            </>
                        )}
                        {status === "EXPIRED" && (
                            <>
                                <XCircle className="w-5 h-5" />
                                <span className="font-bold text-lg">Pembayaran Kadaluarsa</span>
                            </>
                        )}
                    </div>
                    <ShieldCheck className="w-6 h-6 opacity-90" />
                </div>
                
                {/* Timer Display */}
                {status === "PENDING" && (
                    <div className="text-center text-white/90 text-sm font-medium mb-4 z-10" data-html2canvas-ignore="true">
                        Selesaikan dalam <span className="font-bold font-mono">{timeLeft}</span>
                    </div>
                )}
                
                {/* Floating Content Card */}
                <div 
                    ref={cardRef}
                    className="flex-1 bg-white rounded-t-[32px] pt-14 px-6 pb-8 flex flex-col items-center relative shadow-[0_-10px_20px_rgba(0,0,0,0.1)] mt-8"
                >
                    {/* Floating Avatar */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-full p-2 shadow-lg">
                        <div className="w-full h-full bg-slate-100 rounded-full overflow-hidden flex items-center justify-center">
                            <img src="/logo-infoloker.png" alt="Logo" className="w-12 h-12 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">infolokerjombang</h2>
                    <p className="text-slate-500 text-sm font-semibold mb-6 bg-slate-100 px-4 py-1.5 rounded-full">Rp {totalAmount.toLocaleString("id-ID")}</p>
                    
                    <div className="w-full max-w-[280px] aspect-square flex items-center justify-center p-5 rounded-[32px] border-2 border-slate-100 bg-white mb-6 shadow-sm relative overflow-hidden">
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
                            <div className="w-full h-full rounded-lg bg-slate-50 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                            </div>
                        )}
                        
                        {status === "PAID" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                <div className="bg-emerald-500 rounded-full p-4 shadow-xl shadow-emerald-500/50">
                                    <CheckCircle2 className="w-12 h-12 text-white" />
                                </div>
                            </div>
                        )}
                        {status === "EXPIRED" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px]">
                                <div className="bg-red-500 rounded-full p-4 shadow-xl shadow-red-500/50">
                                    <XCircle className="w-12 h-12 text-white" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Penjelasan / Instruksi Scan */}
                    <div className="w-full bg-emerald-50 rounded-2xl p-5 mb-auto border border-emerald-100/80">
                        <h3 className="text-emerald-800 font-bold text-sm mb-3 flex items-center gap-2">
                            <span className="w-6 h-6 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-800 text-xs">ℹ</span>
                            Cara Pembayaran
                        </h3>
                        <ol className="text-emerald-700/80 text-xs space-y-2.5 font-medium leading-relaxed pl-1">
                            <li className="flex gap-2">
                                <span className="font-bold">1.</span>
                                <span>Buka aplikasi e-Wallet atau M-Banking Anda (Gopay, OVO, BCA, dll).</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold">2.</span>
                                <span>Pilih opsi <strong>Scan QRIS</strong>.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold">3.</span>
                                <span>Arahkan kamera ke QR Code di atas, atau masukkan gambar QR ini dari galeri.</span>
                            </li>
                            <li className="flex gap-2">
                                <span className="font-bold">4.</span>
                                <span>Pastikan nama merchant adalah <strong>infolokerjombang</strong>.</span>
                            </li>
                        </ol>
                    </div>
                    
                    {/* Tombol Simpan */}
                    <button 
                        data-html2canvas-ignore="true"
                        onClick={handleDownload}
                        disabled={isDownloading || status !== "PENDING"}
                        className="w-full mt-6 bg-[#00a550] hover:bg-[#008c44] text-white py-4 rounded-[20px] font-bold text-base flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} 
                        {isDownloading ? "Menyimpan QR..." : "Simpan QR Code"}
                    </button>
                </div>
            </div>
        </>
    );
}
