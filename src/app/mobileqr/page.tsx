"use client";

import { useRef, useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Instagram, QrCode, Download, Loader2, Wallet, CreditCard, Sparkles, Moon, Sun, X, ChevronLeft, Home, User, Maximize, Bell, Share2, MoreHorizontal, Settings, Clock, Activity, Zap, ArrowLeft, ArrowUpRight, ShieldCheck, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";

const QR_URL = "https://instagram.com/infolokerjombang";
const MERCHANT_NAME = "infolokerjombang";
const INSTAGRAM_HANDLE = "@infolokerjombang";

function QRCardWrapper({ children, title, id }: { children: React.ReactNode, title: string, id: string }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        const toastId = toast.loading(`Mendownload ${title}...`);
        
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
            link.download = `Mobile-QR-${MERCHANT_NAME}-${id}.png`;
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

    return (
        <div className="flex flex-col items-center group w-full">
            <div className="w-full relative flex justify-center">
                <div ref={cardRef} className="relative inline-block rounded-[40px]">
                    {children}
                </div>
                
                <button
                    data-html2canvas-ignore="true"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    title={`Download ${title}`}
                    className="absolute -bottom-5 right-0 md:-right-6 p-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white rounded-full shadow-2xl transition-all active:scale-95 disabled:opacity-50 z-50 flex items-center justify-center group/btn ring-4 ring-white dark:ring-slate-950"
                >
                    {isDownloading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6 group-hover/btn:-translate-y-1 transition-transform" />}
                </button>
            </div>
            
            <div className="mt-10 flex flex-col items-center gap-3 w-full">
                <p className="font-bold text-slate-700 dark:text-slate-300 text-base tracking-wide">{title}</p>
            </div>
        </div>
    );
}

export default function MobileQRPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-6 md:p-12 relative font-sans">
            {mounted && (
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="fixed top-6 right-6 md:top-12 md:right-12 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-md text-slate-700 dark:text-slate-300 hover:scale-105 transition-transform z-50"
                    title="Toggle Theme"
                >
                    {theme === "dark" ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                </button>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20 px-4">
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-slate-900 dark:text-white">Clean & Native QR Styles</h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Koleksi 6 desain profesional berbasis layout aplikasi Dompet Digital & Fintech modern. Bersih, elegan, dan siap digunakan.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-24 pb-20 justify-items-center">

                    {/* Style 1: E-Wallet Purple App (Kept original user liked) */}
                    <QRCardWrapper id="ewallet-purple" title="1. E-Wallet Purple">
                        <div className="w-[320px] h-[650px] bg-[#5c5cff] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-900 dark:border-slate-800">
                            <div className="flex justify-between items-center px-6 pt-12 pb-4 text-white">
                                <X className="w-5 h-5" />
                                <span className="font-bold text-xs tracking-widest uppercase">My QR Code</span>
                                <MoreHorizontal className="w-5 h-5" />
                            </div>
                            
                            <div className="flex-1 px-5 pb-6 flex flex-col">
                                <div className="bg-white rounded-[32px] p-6 flex flex-col items-center shadow-lg w-full">
                                    <div className="flex items-center gap-3 w-full mb-6">
                                        <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                            <img src="/profile.png" alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-slate-800 font-bold text-sm truncate">{MERCHANT_NAME}</span>
                                            <span className="text-slate-500 text-xs truncate">{INSTAGRAM_HANDLE}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="w-full aspect-square flex items-center justify-center mb-4">
                                        <QRCodeSVG value={QR_URL} size={200} level="H" />
                                    </div>
                                </div>
                                
                                <div className="mt-6 bg-white/20 rounded-[20px] p-4 flex items-start gap-4 text-white backdrop-blur-sm">
                                    <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center shrink-0">
                                        <div className="w-3 h-3 bg-white rounded-full"></div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm mb-1">How to use QR Code?</span>
                                        <span className="text-xs opacity-90 leading-tight font-medium">Simply show the QR Code and your friend can scan it and pay.</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="h-[80px] bg-white rounded-t-[32px] flex justify-between items-center px-8 relative shadow-[0_-10px_20px_rgba(0,0,0,0.05)] mt-auto text-slate-300">
                                <Home className="w-6 h-6 hover:text-indigo-500 transition-colors cursor-pointer" />
                                <CreditCard className="w-6 h-6 hover:text-indigo-500 transition-colors cursor-pointer" />
                                
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-[#10b981] rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-400/40 text-white rotate-45 cursor-pointer hover:scale-105 transition-transform">
                                    <Maximize className="w-6 h-6 -rotate-45" />
                                </div>
                                
                                <Clock className="w-6 h-6 hover:text-indigo-500 transition-colors cursor-pointer" />
                                <User className="w-6 h-6 hover:text-indigo-500 transition-colors cursor-pointer" />
                            </div>
                        </div>
                    </QRCardWrapper>

                    {/* Style 2: Modern Green Wallet (GoPay/Grab inspired) */}
                    <QRCardWrapper id="green-wallet" title="2. Green E-Wallet">
                        <div className="w-[320px] h-[650px] bg-[#00a550] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-900 dark:border-slate-800">
                            <div className="flex justify-between items-center px-6 pt-12 pb-8 text-white relative z-10">
                                <div className="flex items-center gap-3">
                                    <ArrowLeft className="w-6 h-6" />
                                    <span className="font-bold text-lg">Receive Payment</span>
                                </div>
                                <ShieldCheck className="w-6 h-6 opacity-90" />
                            </div>
                            
                            <div className="flex-1 bg-white rounded-t-[32px] pt-8 px-6 pb-6 flex flex-col items-center relative shadow-[0_-10px_20px_rgba(0,0,0,0.1)] mt-4">
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-full p-2 shadow-lg">
                                    <div className="w-full h-full bg-slate-100 rounded-full overflow-hidden">
                                        <img src="/profile.png" alt="Profile" className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                
                                <h2 className="text-xl font-bold text-slate-800 mt-10 mb-1">{MERCHANT_NAME}</h2>
                                <p className="text-slate-500 text-sm font-medium mb-8 bg-slate-100 px-4 py-1.5 rounded-full">{INSTAGRAM_HANDLE}</p>
                                
                                <div className="w-full aspect-square flex items-center justify-center p-4 rounded-[28px] border-2 border-slate-100 bg-white mb-auto shadow-sm">
                                    <QRCodeSVG value={QR_URL} size={200} level="H" fgColor="#0f172a" />
                                </div>
                                
                                <button className="w-full mt-8 bg-[#00a550] text-white py-4 rounded-[20px] font-bold text-base flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/30">
                                    <Share2 className="w-5 h-5" /> Share QR Code
                                </button>
                            </div>
                        </div>
                    </QRCardWrapper>

                    {/* Style 3: Clean Fintech (Kept original user liked) */}
                    <QRCardWrapper id="clean-fintech" title="3. Clean Fintech">
                        <div className="w-[320px] h-[650px] bg-white rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-900 dark:border-slate-800">
                            <div className="flex justify-between items-center px-6 pt-12 pb-4 text-slate-800">
                                <ChevronLeft className="w-6 h-6" />
                                <span className="font-bold text-lg">Receive</span>
                                <Settings className="w-5 h-5" />
                            </div>
                            
                            <div className="px-6 mt-6 flex flex-col items-center">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                                    <Wallet className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 mb-1">{MERCHANT_NAME}</h2>
                                <p className="text-slate-500 font-medium text-sm">{INSTAGRAM_HANDLE}</p>
                            </div>
                            
                            <div className="mt-8 px-6 flex-1 flex flex-col items-center">
                                <div className="p-4 bg-white rounded-[32px] shadow-[0_15px_40px_rgba(0,0,0,0.08)] border border-slate-100">
                                    <QRCodeSVG value={QR_URL} size={200} level="H" fgColor="#0f172a" />
                                </div>
                                <p className="mt-8 text-sm text-slate-400 font-medium text-center px-4 leading-relaxed">Scan this QR code to initiate payment transfer securely.</p>
                            </div>
                            
                            <div className="p-6 mt-auto">
                                <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-base shadow-lg shadow-slate-900/20 active:scale-95 transition-transform">Save QR Image</button>
                            </div>
                        </div>
                    </QRCardWrapper>

                    {/* Style 4: Deep Blue Fintech (Dana/PayPal style) */}
                    <QRCardWrapper id="blue-wallet" title="4. Blue Fintech App">
                        <div className="w-[320px] h-[650px] bg-blue-600 rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-900 dark:border-slate-800">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 opacity-50"></div>
                            
                            <div className="flex justify-between items-center px-6 pt-12 pb-6 text-white relative z-10">
                                <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                                    <ArrowLeft className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-base tracking-wide">Show QR</span>
                                <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                                    <Share2 className="w-5 h-5" />
                                </div>
                            </div>
                            
                            <div className="px-6 flex-1 flex flex-col items-center relative z-10">
                                <div className="w-full bg-white rounded-[32px] p-8 shadow-2xl flex flex-col items-center">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-6">Scan to Transfer</span>
                                    
                                    <div className="w-full flex justify-center mb-8">
                                        <QRCodeSVG value={QR_URL} size={180} level="H" fgColor="#1e3a8a" />
                                    </div>
                                    
                                    <div className="h-[1px] w-full bg-slate-100 mb-6"></div>
                                    
                                    <h2 className="text-xl font-bold text-slate-800 text-center">{MERCHANT_NAME}</h2>
                                    <p className="text-blue-600 font-semibold mt-1">{INSTAGRAM_HANDLE}</p>
                                </div>
                            </div>
                            
                            <div className="px-8 pb-8 pt-4 flex justify-between items-center bg-white/10 mx-6 mb-6 rounded-3xl backdrop-blur-md border border-white/20 mt-auto text-white">
                                <div className="flex flex-col items-center gap-1 opacity-50">
                                    <ArrowUpRight className="w-6 h-6" />
                                    <span className="text-[10px] font-bold">Pay</span>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <QrCode className="w-6 h-6" />
                                    <span className="text-[10px] font-bold">QR</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 opacity-50">
                                    <History className="w-6 h-6" />
                                    <span className="text-[10px] font-bold">History</span>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>

                    {/* Style 5: Neobank Light (Jago/Jenius style) */}
                    <QRCardWrapper id="neobank-light" title="5. Neobank Minimalist">
                        <div className="w-[320px] h-[650px] bg-[#f4f6f8] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-900 dark:border-slate-800">
                            <div className="flex justify-between items-start px-6 pt-12 pb-6">
                                <div className="flex flex-col gap-1">
                                    <span className="text-slate-500 text-sm">Transfer to</span>
                                    <span className="text-slate-900 font-black text-2xl">{MERCHANT_NAME}</span>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                                    <img src="/profile.png" alt="Profile" className="w-full h-full object-cover" />
                                </div>
                            </div>
                            
                            <div className="px-6 flex-1 flex flex-col mt-4">
                                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 flex flex-col items-center">
                                    <div className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-xs font-bold mb-8 border border-orange-100">
                                        {INSTAGRAM_HANDLE}
                                    </div>
                                    
                                    <div className="w-full aspect-square flex justify-center items-center mb-4">
                                        <QRCodeSVG value={QR_URL} size={190} level="H" fgColor="#0f172a" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="p-6 mt-auto flex gap-4">
                                <button className="flex-1 py-4 bg-white text-slate-800 rounded-[20px] font-bold text-sm shadow-[0_4px_15px_rgb(0,0,0,0.05)] border border-slate-100">Cancel</button>
                                <button className="flex-1 py-4 bg-[#ff6b00] text-white rounded-[20px] font-bold text-sm shadow-[0_8px_20px_rgba(255,107,0,0.3)]">Download</button>
                            </div>
                        </div>
                    </QRCardWrapper>

                    {/* Style 6: Elegant Dark Wallet */}
                    <QRCardWrapper id="elegant-dark" title="6. Elegant Dark Wallet">
                        <div className="w-[320px] h-[650px] bg-[#111318] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col font-sans border-[6px] border-slate-800">
                            <div className="flex justify-between items-center px-6 pt-12 pb-4 text-slate-300">
                                <ArrowLeft className="w-6 h-6" />
                                <span className="font-semibold text-base tracking-wide text-white">QR Receipt</span>
                                <MoreHorizontal className="w-6 h-6" />
                            </div>
                            
                            <div className="px-5 mt-6 flex-1 flex flex-col">
                                <div className="w-full bg-[#1c1f26] rounded-[32px] p-6 shadow-2xl border border-slate-800 flex flex-col justify-center items-center">
                                    <div className="w-full flex justify-between items-center mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white">
                                                <Wallet className="w-5 h-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold text-sm">{MERCHANT_NAME}</span>
                                                <span className="text-slate-500 text-xs">{INSTAGRAM_HANDLE}</span>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-white p-4 rounded-[24px] shadow-inner w-full flex items-center justify-center">
                                        <QRCodeSVG value={QR_URL} size={190} level="H" fgColor="#111318" />
                                    </div>
                                    <p className="text-slate-400 text-xs text-center mt-6 px-2 leading-relaxed">Present this code at checkout to process the transaction automatically.</p>
                                </div>
                            </div>
                            
                            <div className="mt-auto pt-6 pb-8 px-6">
                                <div className="w-full bg-[#1c1f26] rounded-[24px] p-2 flex justify-between items-center border border-slate-800">
                                    <div className="py-3 px-6 rounded-[16px] text-slate-400 font-semibold text-sm flex-1 text-center cursor-pointer hover:text-white transition-colors">Share</div>
                                    <div className="py-3 px-6 rounded-[16px] bg-emerald-500 text-white font-semibold text-sm flex-1 text-center shadow-lg shadow-emerald-500/20 cursor-pointer">Save</div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>

                </div>
            </div>
        </div>
    );
}
