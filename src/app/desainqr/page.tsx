"use client";

import { useRef, useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Instagram, QrCode, Download, Loader2, Wallet, CreditCard, Sparkles, Receipt, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";

const QR_URL = "https://instagram.com/infolokerjombang";
const MERCHANT_NAME = "infolokerjombang";
const INSTAGRAM_HANDLE = "@infolokerjombang";

// Reusable wrapper to handle downloading any QR card design
function QRCardWrapper({ children, title, id }: { children: React.ReactNode, title: string, id: string }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        const toastId = toast.loading(`Mendownload ${title}...`);
        
        try {
            // Slight delay to ensure any fonts/animations are settled
            await new Promise(r => setTimeout(r, 200));
            
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 4, // Very high scale for crisp PNG
                filter: (node) => {
                    // Exclude elements with the ignore attribute
                    if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true") {
                        return false;
                    }
                    return true;
                },
                backgroundColor: 'transparent' // preserve transparency if any
            });
            
            const link = document.createElement("a");
            link.download = `QR-Pembayaran-${MERCHANT_NAME}-${id}.png`;
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
            <div className="w-full relative">
                {/* The card itself that will be captured */}
                <div ref={cardRef} className="w-full relative">
                    {children}
                </div>
                
                {/* Download Button (Overlay inside the card but ignored by html2canvas) */}
                <button
                    data-html2canvas-ignore="true"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    title={`Download ${title}`}
                    className="absolute bottom-4 right-4 p-2.5 bg-slate-900/50 hover:bg-slate-900/80 backdrop-blur-md text-white rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50 z-50 flex items-center justify-center group/btn"
                >
                    {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5 group-hover/btn:-translate-y-0.5 transition-transform" />}
                </button>
            </div>
            
            <div className="mt-4 flex flex-col items-center gap-3 w-full">
                <p className="font-semibold text-slate-700 dark:text-slate-300">{title}</p>
            </div>
        </div>
    );
}

export default function DesainQRPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 relative">
            {/* Theme Toggle */}
            {mounted && (
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="absolute top-6 right-6 md:top-12 md:right-12 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-md text-slate-700 dark:text-slate-300 hover:scale-105 transition-transform z-50"
                    title="Toggle Theme"
                >
                    {theme === "dark" ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
                </button>
            )}

            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 px-4">
                    <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Koleksi QR Code Pembayaran</h1>
                    <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">Pilih dari 6 desain QR code eksklusif untuk mempermudah transaksi customer {MERCHANT_NAME}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">

                    {/* Style: 1. Indigo & Pink */}
                    <QRCardWrapper id="vibrant-indigo" title="1. Indigo & Pink">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 relative overflow-hidden shadow-xl shadow-purple-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-purple-500/25 shrink-0">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-purple-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-pink-600 dark:text-pink-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>


                    {/* Style: 2. Sunset Blaze */}
                    <QRCardWrapper id="sunset-blaze" title="2. Sunset Blaze">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 relative overflow-hidden shadow-xl shadow-rose-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-orange-500 via-rose-500 to-pink-500 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-rose-500/25 shrink-0">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 shadow-xl shadow-rose-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-rose-600 dark:text-rose-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>


                    {/* Style: 3. Oceanic Depth */}
                    <QRCardWrapper id="oceanic-depth" title="3. Oceanic Depth">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 relative overflow-hidden shadow-xl shadow-cyan-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-blue-500 via-cyan-500 to-teal-500 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-cyan-500/25 shrink-0">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500 shadow-xl shadow-cyan-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-cyan-600 dark:text-cyan-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>


                    {/* Style: 4. Forest Canopy */}
                    <QRCardWrapper id="forest-canopy" title="4. Forest Canopy">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 relative overflow-hidden shadow-xl shadow-teal-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-600 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-teal-500/25 shrink-0">
                                        <Receipt className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-600">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 shadow-xl shadow-teal-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-teal-600 dark:text-teal-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>


                    {/* Style: 5. Amethyst Glow */}
                    <QRCardWrapper id="amethyst-glow" title="5. Amethyst Glow">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 relative overflow-hidden shadow-xl shadow-violet-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-violet-500 via-purple-500 to-indigo-500 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-violet-500/25 shrink-0">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-500 shadow-xl shadow-violet-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-violet-600 dark:text-violet-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>


                    {/* Style: 6. Golden Aurora */}
                    <QRCardWrapper id="golden-aurora" title="6. Golden Aurora">
                        <div className="w-full h-full rounded-[2rem] p-1 bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 relative overflow-hidden shadow-xl shadow-amber-500/25 flex flex-col">
                            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[1.8rem] p-5 sm:p-6 flex flex-col relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 opacity-10 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-amber-400 via-orange-400 to-yellow-500 opacity-10 rounded-tr-full -ml-8 -mb-8"></div>
                                
                                <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full min-h-0 py-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 rounded-full flex items-center justify-center mb-4 text-white shadow-lg shadow-amber-500/25 shrink-0">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    
                                    <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 mb-5 text-center tracking-tight shrink-0 flex items-center justify-center gap-1.5 flex-wrap">
                                        Scan Untuk <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500">Membayar</span>
                                    </h2>
                                    
                                    <div className="p-1 rounded-[1.3rem] bg-gradient-to-br from-amber-400 via-orange-400 to-yellow-500 shadow-xl shadow-amber-500/25 w-full max-w-[240px] aspect-square flex items-center justify-center shrink-0">
                                        <div className="p-3 w-full h-full bg-white dark:bg-slate-900 rounded-[1.1rem] text-slate-900 dark:text-white flex items-center justify-center">
                                            <QRCodeSVG value={QR_URL} size={256} level="H" fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="relative z-10 bg-slate-50 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-full text-center mt-6 border border-slate-100 dark:border-slate-800 shrink-0">
                                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight uppercase truncate">{MERCHANT_NAME}</h3>
                                    <div className="flex items-center justify-center gap-1.5 mt-1 text-orange-600 dark:text-orange-400">
                                        <Instagram className="w-4 h-4" />
                                        <span className="text-sm font-semibold tracking-wide truncate">{INSTAGRAM_HANDLE}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </QRCardWrapper>

</div>
            </div>
        </div>
    );
}

