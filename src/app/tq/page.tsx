"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, MessageCircle, Home, FileText, Smartphone, RefreshCcw, Clock, ShieldCheck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ThankYouPage() {
    const [style, setStyle] = useState<1 | 2 | 3>(1);

    // Style 1: Classic Green E-Wallet (Konsisten dengan tesqrmobile)
    const renderStyle1 = () => (
        <motion.div 
            key="style1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden min-h-screen bg-[#00a550] flex flex-col font-sans relative overflow-x-hidden"
        >
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
            <div className="absolute top-1/4 left-0 w-48 h-48 bg-[#008c44] rounded-full blur-2xl -translate-x-1/2 pointer-events-none" />
            
            {/* Header */}
            <div className="flex justify-center items-center px-6 pt-12 pb-16 text-white relative z-10">
                <span className="font-bold text-lg tracking-tight">Status Pembayaran</span>
            </div>
            
            {/* Floating Content Card */}
            <div className="flex-1 bg-[#f8fafc] rounded-t-[32px] pt-20 px-6 pb-8 flex flex-col items-center relative shadow-[0_-20px_40px_rgba(0,0,0,0.15)] z-20">
                {/* Floating Success Icon */}
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 w-28 h-28 z-30">
                    <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                        className="w-full h-full bg-white rounded-full p-2.5 shadow-xl"
                    >
                        <div className="w-full h-full bg-[#00a550] rounded-full flex items-center justify-center relative overflow-hidden">
                            <motion.div 
                                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                                className="absolute inset-0 bg-white/60 rounded-full"
                            />
                            <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <CheckCircle2 className="w-14 h-14 text-white relative z-10" strokeWidth={2.5} />
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
                
                <motion.h2 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                    className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-slate-500 mb-3 tracking-tight text-center leading-tight"
                >
                    Pembayaran Diproses
                </motion.h2>
                
                <motion.div 
                    initial="hidden" animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.4 } }
                    }}
                    className="w-full mb-8 space-y-4"
                >
                    <motion.p 
                        variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                        className="text-slate-500 text-[13.5px] font-medium text-center mb-6 max-w-[280px] mx-auto leading-relaxed"
                    >
                        Terima kasih telah mempercayakan publikasi lowongan perusahaan Anda kepada Infolokerjombang.
                    </motion.p>

                    <motion.div 
                        variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                        className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                    >
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-slate-600 text-[13px] leading-relaxed">
                            <strong className="text-slate-800 block mb-0.5">Sedang Kami Cek</strong>
                            Data dan pembayaran sudah diterima. Tim akan segera menghubungi via WhatsApp untuk jadwal tayang.
                        </p>
                    </motion.div>

                    <motion.div 
                        variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                        className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                    >
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-slate-600 text-[13px] leading-relaxed">
                            <strong className="text-slate-800 block mb-0.5">Simpan Bukti</strong>
                            Mohon simpan bukti pembayaran untuk berjaga-jaga ya.
                        </p>
                    </motion.div>

                    <motion.div 
                        variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0 } }}
                        className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex gap-3 text-left"
                    >
                        <div className="mt-0.5 w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-slate-600 text-[13px] leading-relaxed">
                            <strong className="text-slate-800 block mb-0.5">Siap Tampil</strong>
                            Lowongan kamu akan segera menjangkau ribuan pencari kerja di Jombang.
                        </p>
                    </motion.div>
                </motion.div>
                
                {/* Receipt Card */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                    className="w-full bg-white rounded-3xl p-5 border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] mb-8"
                >
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100 border-dashed">
                        <span className="text-slate-500 text-sm font-medium">Nominal</span>
                        <span className="text-xl font-black text-slate-800">Rp 50.000</span>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-medium">Tanggal</span>
                            <span className="text-slate-700 text-xs font-bold">12 Okt 2026, 14:30</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-medium">Metode</span>
                            <span className="text-slate-700 text-xs font-bold">QRIS</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-xs font-medium">ID Transaksi</span>
                            <span className="text-slate-700 text-xs font-mono font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">INV-8X92M</span>
                        </div>
                    </div>
                </motion.div>
                
                {/* Action Buttons */}
                <motion.div 
                    initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                    className="w-full space-y-3 mt-auto"
                >
                    <Link href="https://wa.me/6281234567890" target="_blank" className="w-full bg-[#00a550] hover:bg-[#008c44] text-white py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all">
                        <MessageCircle className="w-5 h-5" /> Konfirmasi ke Admin
                    </Link>
                    <Link href="/" className="w-full bg-emerald-50 hover:bg-emerald-100 text-[#00a550] py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 active:scale-[0.98] transition-all">
                        <Home className="w-5 h-5" /> Kembali ke Beranda
                    </Link>
                </motion.div>
            </div>
        </motion.div>
    );

    // Style 2: Modern Clean Light
    const renderStyle2 = () => (
        <motion.div 
            key="style2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden min-h-screen bg-slate-50 flex flex-col font-sans"
        >
            <div className="flex-1 flex flex-col items-center pt-24 px-6 pb-10">
                <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", bounce: 0.5 }}
                    className="relative mb-8"
                >
                    <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-20" />
                    <div className="w-28 h-28 bg-emerald-100 rounded-full flex items-center justify-center relative z-10 border-[6px] border-white shadow-xl shadow-emerald-500/10">
                        <CheckCircle2 className="w-14 h-14 text-emerald-500" strokeWidth={3} />
                    </div>
                </motion.div>

                <h2 className="text-[28px] font-black text-slate-800 mb-3 tracking-tight text-center leading-none">
                    Transaksi<br/>Selesai!
                </h2>
                
                <p className="text-slate-500 text-[15px] font-medium mb-10 text-center max-w-[280px]">
                    Luar biasa! Pembayaran Anda telah kami konfirmasi secara otomatis.
                </p>

                <div className="w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-auto relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <div className="flex flex-col items-center justify-center mb-6 pb-6 border-b border-slate-50">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Tagihan</span>
                        <span className="text-[32px] font-black text-slate-800 tracking-tighter">Rp 50.000</span>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <span className="text-slate-500 text-sm font-medium">Order ID</span>
                            </div>
                            <span className="text-slate-700 text-sm font-bold">#ORD-9921</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <span className="text-slate-500 text-sm font-medium">Status</span>
                            </div>
                            <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-2.5 py-1 rounded-full">Berhasil</span>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-4 mt-8">
                    <Link href="https://wa.me/6281234567890" target="_blank" className="w-full flex items-center justify-between bg-slate-800 text-white p-4 rounded-2xl active:scale-[0.98] transition-transform shadow-lg shadow-slate-800/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="font-bold text-[15px]">Hubungi Admin</span>
                                <span className="text-xs text-slate-300 font-medium">Kirim bukti via WhatsApp</span>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 opacity-50" />
                    </Link>
                    <Link href="/" className="w-full flex items-center justify-center text-slate-500 font-bold text-sm py-4">
                        Kembali ke Halaman Utama
                    </Link>
                </div>
            </div>
        </motion.div>
    );

    // Style 3: Premium Dark Wallet
    const renderStyle3 = () => (
        <motion.div 
            key="style3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="md:hidden min-h-screen bg-[#0f172a] flex flex-col font-sans relative overflow-hidden"
        >
            {/* Glowing background */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="flex-1 flex flex-col px-6 pt-20 pb-8 relative z-10">
                <div className="flex items-center gap-4 mb-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                        <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={3} />
                    </div>
                    <div>
                        <h2 className="text-[22px] font-black text-white tracking-tight leading-tight">Payment<br/>Successful.</h2>
                    </div>
                </div>

                <div className="w-full bg-[#1e293b]/80 backdrop-blur-xl border border-slate-700/50 rounded-[32px] p-6 shadow-2xl relative overflow-hidden mb-auto">
                    {/* Inner glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-2xl rounded-full" />
                    
                    <p className="text-slate-400 text-sm font-medium mb-1">Total Paid</p>
                    <h3 className="text-[36px] font-black text-white tracking-tighter mb-8 flex items-start gap-1">
                        <span className="text-xl font-bold text-emerald-400 mt-2">Rp</span>
                        50.000
                    </h3>

                    <div className="space-y-5">
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Merchant</span>
                            <span className="text-slate-200 text-[15px] font-bold">Info Loker Jombang</span>
                        </div>
                        <div className="h-px w-full bg-slate-700/50" />
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Transaction ID</span>
                            <span className="text-slate-200 text-[15px] font-mono font-bold tracking-widest">TRX-098X2</span>
                        </div>
                        <div className="h-px w-full bg-slate-700/50" />
                        <div className="flex flex-col gap-1">
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Date</span>
                            <span className="text-slate-200 text-[15px] font-bold">12 Oct 2026, 14:30 WIB</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-8">
                    <Link href="https://wa.me/6281234567890" target="_blank" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-full font-bold text-[15px] flex justify-center items-center gap-2 shadow-[0_10px_20px_-10px_rgba(16,185,129,0.5)] active:scale-[0.98] transition-all">
                        <MessageCircle className="w-5 h-5" /> Konfirmasi ke Admin
                    </Link>
                    <Link href="/" className="w-full bg-[#1e293b] hover:bg-slate-800 text-white border border-slate-700 py-4 rounded-full font-bold text-[15px] flex justify-center items-center gap-2 active:scale-[0.98] transition-all">
                        Kembali ke Home
                    </Link>
                </div>
            </div>
        </motion.div>
    );

    return (
        <>
            {/* Desktop View (Showcase mode) */}
            <div className="hidden md:flex min-h-screen bg-slate-100 flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 text-emerald-500">
                    <Smartphone className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Preview Mobile Thank You Page</h1>
                <p className="text-slate-500 max-w-md text-lg leading-relaxed mb-8">
                    Halaman ini memiliki 3 style native mobile. Silakan buka melalui smartphone atau gunakan Developer Tools (F12) mode mobile.
                </p>
                <div className="flex gap-4 p-2 bg-white rounded-2xl shadow-sm border border-slate-200">
                    {[1, 2, 3].map((s) => (
                        <button 
                            key={s} 
                            onClick={() => setStyle(s as 1|2|3)}
                            className={cn(
                                "px-6 py-3 rounded-xl font-bold transition-all",
                                style === s ? "bg-[#00a550] text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                            )}
                        >
                            Style {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile View Toggle Button (Floating) */}
            <div className="md:hidden fixed top-4 right-4 z-[100]">
                <button 
                    onClick={() => setStyle((style % 3 + 1) as 1|2|3)}
                    className="w-10 h-10 bg-black/20 backdrop-blur-md border border-white/30 rounded-full flex items-center justify-center shadow-lg text-white"
                >
                    <RefreshCcw className="w-5 h-5" />
                </button>
            </div>

            {/* Render selected style on mobile */}
            <AnimatePresence mode="wait">
                {style === 1 && renderStyle1()}
                {style === 2 && renderStyle2()}
                {style === 3 && renderStyle3()}
            </AnimatePresence>
        </>
    );
}
