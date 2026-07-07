"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, ShieldCheck, Loader2, Download, Smartphone } from "lucide-react";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";

const QR_URL = "https://instagram.com/infolokerjombang";
const MERCHANT_NAME = "infolokerjombang";
const INSTAGRAM_HANDLE = "@infolokerjombang";

export default function TesQRMobilePage() {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsDownloading(true);
        const toastId = toast.loading("Menyimpan QR Code...");
        
        try {
            await new Promise(r => setTimeout(r, 200));
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 3,
                filter: (node) => {
                    if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true") {
                        return false;
                    }
                    return true;
                },
                backgroundColor: '#00a550'
            });
            
            const link = document.createElement("a");
            link.download = `QR-${MERCHANT_NAME}.png`;
            link.href = dataUrl;
            link.click();
            toast.success("Tersimpan di galeri!", { id: toastId });
        } catch (error) {
            console.error("Failed", error);
            toast.error("Gagal menyimpan", { id: toastId });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <>
            {/* Desktop / Non-Mobile Warning */}
            <div className="hidden md:flex min-h-screen bg-slate-100 flex-col items-center justify-center p-6 text-center">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-6 text-emerald-500">
                    <Smartphone className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Hanya Untuk Pengguna Mobile</h1>
                <p className="text-slate-500 max-w-md text-lg leading-relaxed">
                    Halaman ini didesain 100% khusus untuk tampilan native mobile layar penuh. 
                    Silakan buka link ini melalui perangkat smartphone Anda untuk mengaksesnya.
                </p>
            </div>

            {/* Mobile Native View (Full Screen) */}
            <div className="md:hidden min-h-screen bg-[#00a550] flex flex-col font-sans" ref={cardRef}>
                {/* Header (Diabaikan saat download) */}
                <div className="flex justify-between items-center px-6 pt-12 pb-6 text-white relative z-10" data-html2canvas-ignore="true">
                    <div className="flex items-center gap-3">
                        <ArrowLeft className="w-6 h-6" />
                        <span className="font-bold text-lg">Terima Pembayaran</span>
                    </div>
                    <ShieldCheck className="w-6 h-6 opacity-90" />
                </div>
                
                {/* Floating Content Card (Memanjang ke bawah memenuhi layar) */}
                <div className="flex-1 bg-white rounded-t-[32px] pt-14 px-6 pb-8 flex flex-col items-center relative shadow-[0_-10px_20px_rgba(0,0,0,0.1)] mt-8">
                    {/* Floating Avatar */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-white rounded-full p-2 shadow-lg">
                        <div className="w-full h-full bg-slate-100 rounded-full overflow-hidden">
                            <img src="/profile.png" alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">{MERCHANT_NAME}</h2>
                    <p className="text-slate-500 text-sm font-semibold mb-8 bg-slate-100 px-4 py-1.5 rounded-full">{INSTAGRAM_HANDLE}</p>
                    
                    <div className="w-full max-w-[280px] aspect-square flex items-center justify-center p-5 rounded-[32px] border-2 border-slate-100 bg-white mb-8 shadow-sm">
                        <QRCodeSVG value={QR_URL} size={220} level="H" fgColor="#0f172a" style={{ width: "100%", height: "100%" }} />
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
                                <span>Masukkan nominal dan selesaikan pembayaran.</span>
                            </li>
                        </ol>
                    </div>
                    
                    {/* Tombol Simpan (Diabaikan saat download, tapi yang terekam adalah isi Card) */}
                    <button 
                        data-html2canvas-ignore="true"
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="w-full mt-6 bg-[#00a550] hover:bg-[#008c44] text-white py-4 rounded-[20px] font-bold text-base flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-[0.98] transition-all disabled:opacity-70"
                    >
                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />} 
                        {isDownloading ? "Menyimpan QR..." : "Simpan QR Code"}
                    </button>
                </div>
            </div>
        </>
    );
}
