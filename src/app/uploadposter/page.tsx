"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    CheckCircle2, ImagePlus, Upload, X, FileText, Send, Loader2, ShieldCheck, Home
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { uploadPoster } from "@/lib/posting-service";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function UploadPosterContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
    
    // Upload Poster States
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [posterFiles, setPosterFiles] = useState<File[]>([]);
    const [posterPreviews, setPosterPreviews] = useState<string[]>([]);
    const [posterCaption, setPosterCaption] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Success State
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const urlWa = searchParams.get("whatsapp");
        if (urlWa) {
            setWhatsappNumber(urlWa);
        }
    }, [searchParams]);

    // Prevent hydration errors
    if (!isClient) return null;

    // File handling for poster upload
    const handleFileSelect = (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        fileArray.forEach(file => {
            if (file.size > 50 * 1024 * 1024) {
                alert(`File ${file.name} terlalu besar (max 50MB)`);
                return;
            }
            if (!file.type.startsWith('image/')) {
                alert(`File ${file.name} bukan gambar`);
                return;
            }
            validFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        });

        setPosterFiles(prev => [...prev, ...validFiles]);
        setPosterPreviews(prev => [...prev, ...newPreviews]);
    };

    const removePosterFile = (index: number) => {
        URL.revokeObjectURL(posterPreviews[index]);
        setPosterFiles(prev => prev.filter((_, i) => i !== index));
        setPosterPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const handleUploadSubmit = async () => {
        if (!whatsappNumber.trim()) {
            alert("Nomor WhatsApp wajib diisi!");
            return;
        }

        if (posterFiles.length === 0) {
            alert("Pilih minimal 1 poster untuk diupload");
            return;
        }

        setIsUploading(true);
        try {
            // Upload all files to Supabase Storage (HD, no compression)
            const uploadedUrls: string[] = [];
            for (const file of posterFiles) {
                const { url, error } = await uploadPoster(file);
                if (error || !url) {
                    throw new Error(`Gagal upload ${file.name}: ${error}`);
                }
                uploadedUrls.push(url);
            }

            // Call upload-poster API to link posters to posting queue
            const res = await fetch("/api/payment/upload-poster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    whatsapp_number: whatsappNumber.trim(),
                    poster_urls: uploadedUrls,
                    caption: posterCaption || undefined,
                }),
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Gagal menyimpan data poster. Pastikan Nomor WhatsApp benar.");
            }

            // Clean up previews
            posterPreviews.forEach(url => URL.revokeObjectURL(url));

            // Show success
            setIsSuccess(true);
        } catch (error) {
            console.error("Upload error:", error);
            alert(error instanceof Error ? error.message : "Terjadi kesalahan saat upload poster");
        } finally {
            setIsUploading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative font-sans">
                {/* Desktop Background elements */}
                <div className="fixed inset-0 pointer-events-none -z-10 hidden md:block">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
                </div>
                
                {/* Mobile Red glow background */}
                <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-[#9a181e]/10 to-transparent pointer-events-none md:hidden" />
                
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }} 
                    className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl max-w-md w-full text-center relative z-10 border border-slate-100"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                        className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    </motion.div>
                    
                    <h2 className="text-2xl font-black text-slate-800 mb-3">Upload Berhasil!</h2>
                    <p className="text-slate-500 mb-8 font-medium">Poster lowongan Anda sudah diterima dan masuk antrian untuk diposting.</p>
                    
                    <Link href="/" className="block">
                        <Button size="lg" className="w-full rounded-xl font-bold bg-[#0b411d] hover:bg-[#083015] text-white h-12 shadow-md">
                            <Home className="w-4 h-4 mr-2" /> Kembali ke Beranda
                        </Button>
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            {/* ========================================================
                DESKTOP VIEW
                ======================================================== */}
            <div className="hidden md:block min-h-screen bg-background text-foreground transition-colors duration-300">
                {/* Elegant Background Gradient and Pattern */}
                <div className="fixed inset-0 pointer-events-none -z-10">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background dark:from-primary/5 dark:via-background dark:to-background" />
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 dark:opacity-20" />
                </div>

                {/* Header */}
                <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
                    <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-3">
                            <img 
                                src="/logo-infoloker.png" 
                                alt="ILJ Logo" 
                                className="h-9 sm:h-10 w-auto object-contain drop-shadow-sm shrink-0"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                            <div>
                                <h1 className="font-extrabold text-sm text-foreground leading-none tracking-tight hidden sm:block">
                                    infolokerjombang
                                </h1>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-bold tracking-wide uppercase flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Premium Portal
                                </p>
                            </div>
                        </Link>
                        <ModeToggle />
                    </div>
                </header>

                <main className="max-w-2xl mx-auto px-4 py-12 pb-32">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Premium Desktop Header Section */}
                        <div className="text-center relative">
                            {/* Decorative background blurs */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[150px] bg-primary/20 blur-[4rem] rounded-full pointer-events-none -z-10" />
                            
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.1, type: "spring", bounce: 0.4 }}
                                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mb-6 shadow-xl shadow-emerald-500/30 ring-4 ring-background"
                            >
                                <Upload className="w-8 h-8 text-white" />
                            </motion.div>
                            
                            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-100 dark:to-slate-400 tracking-tight mb-3">
                                Upload Poster Lowongan
                            </h2>
                            <p className="text-base text-muted-foreground font-medium max-w-md mx-auto">
                                Lengkapi proses pemasangan lowongan Anda dengan mengunggah materi poster kualitas HD.
                            </p>
                        </div>

                        <Card className="p-8 bg-background/60 backdrop-blur-xl shadow-2xl border-border/50 rounded-[2rem] overflow-hidden relative">
                            {/* Inner subtle glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                            
                            <div className="mb-8 relative z-10">
                                <label className="block text-sm font-bold text-foreground mb-2.5">Nomor WhatsApp</label>
                                <input
                                    type="text"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                    placeholder="Contoh: 081234567890"
                                    className="w-full px-5 py-4 rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-[15px] shadow-inner font-mono tracking-wide"
                                />
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 font-medium">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Masukkan nomor WhatsApp yang Anda gunakan saat memesan paket.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 mb-4">
                                <ImagePlus className="w-4 h-4 text-primary" />
                                <h3 className="font-bold text-foreground">File Poster</h3>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                                Upload poster HD (tanpa kompresi). Format: JPG, PNG, WebP. Maks 50MB per file.
                            </p>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
                                    isDragOver
                                        ? "border-primary bg-primary/5 scale-[1.02]"
                                        : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                                )}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                                />
                                <Upload className={cn(
                                    "w-10 h-10 mx-auto mb-3 transition-colors",
                                    isDragOver ? "text-primary" : "text-muted-foreground/50"
                                )} />
                                <p className="text-sm font-semibold text-foreground mb-1">
                                    {isDragOver ? "Lepaskan file di sini" : "Klik atau drag & drop poster"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Bisa upload lebih dari 1 poster
                                </p>
                            </div>

                            {posterPreviews.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                    {posterPreviews.map((preview, idx) => (
                                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-border/40 shadow-sm">
                                            <img
                                                src={preview}
                                                alt={`Poster ${idx + 1}`}
                                                className="w-full h-32 object-cover"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removePosterFile(idx); }}
                                                className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] font-medium px-2 py-1 text-center">
                                                {posterFiles[idx]?.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card className="p-8 bg-background/60 backdrop-blur-xl shadow-xl border-border/50 rounded-[2rem] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileText className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-foreground">Caption / Catatan</h3>
                                    <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full">Opsional</span>
                                </div>
                                <textarea
                                    value={posterCaption}
                                    onChange={(e) => setPosterCaption(e.target.value)}
                                    placeholder="Tambahkan caption menarik atau instruksi khusus untuk postingan Anda..."
                                    rows={4}
                                    className="w-full px-5 py-4 rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-[15px] shadow-inner resize-none leading-relaxed"
                                />
                            </div>
                        </Card>

                        <div className="pt-4 flex justify-center">
                            <Button
                                size="lg"
                                disabled={posterFiles.length === 0 || isUploading || !whatsappNumber.trim()}
                                onClick={handleUploadSubmit}
                                className="w-full md:w-2/3 rounded-2xl font-bold text-[16px] bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 h-14 transition-all duration-300"
                            >
                                {isUploading ? (
                                    <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Mengupload Materi...</>
                                ) : (
                                    <><Send className="w-5 h-5 mr-3" /> Kirim Poster & Selesaikan</>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                </main>
            </div>

            {/* ========================================================
                MOBILE VIEW (Premium Native App Style with Soft Dark Palette)
                ======================================================== */}
            <div className="md:hidden min-h-screen bg-slate-50 flex flex-col relative text-slate-800 font-sans">
                {/* Mobile Premium Header */}
                <div className="bg-[#0b411d] pt-10 pb-24 px-6 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#9a181e]/40 rounded-full blur-[3rem] pointer-events-none" />
                    <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-[#9a181e]/30 rounded-full blur-[3rem] pointer-events-none" />
                    
                    <div className="flex items-center justify-between relative z-10 mb-2">
                        <Link href="/">
                            <button className="w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full border border-white/10 transition-all active:scale-95">
                                <Home className="w-5 h-5 text-white" />
                            </button>
                        </Link>
                    </div>
                </div>

                <div className="flex-1 bg-[#f8fafc] rounded-t-[2.5rem] px-5 pb-32 w-full flex flex-col relative z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] -mt-12">
                    <div className="w-full h-[180px] shrink-0" />

                    <div className="absolute left-5 right-5 z-30" style={{ top: '-40px' }}>
                        <div 
                            className="w-full rounded-[1.5rem] p-5 pt-14 pb-6 shadow-[0_20px_40px_-10px_rgba(154,24,30,0.4)] border border-white/20 flex flex-col relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #9a181e 0%, #630c10 100%)' }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none z-0" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full blur-xl translate-y-5 -translate-x-5 pointer-events-none z-0" />

                            <div className="text-center relative z-10">
                                <h1 className="font-black text-[24px] text-white tracking-tight leading-none mb-2 drop-shadow-md">Upload Poster</h1>
                                <p className="text-white/80 text-[12px] font-medium mb-4">Pastikan resolusi HD tanpa kompresi</p>
                                <div className="inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 shadow-sm">
                                    <Upload className="w-3.5 h-3.5 text-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Kirim Materi</span>
                                </div>
                            </div>
                        </div>

                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#f8fafc] p-1.5 rounded-[1.25rem] shadow-lg z-50">
                            <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-inner">
                                <img src="/logo-infoloker.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </div>
                        </div>
                    </div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-1 space-y-5">
                        
                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100">
                            <label className="block text-[12px] font-extrabold text-slate-500 mb-2 ml-1 uppercase tracking-wider">Nomor WhatsApp</label>
                            <input
                                type="text"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                placeholder="Contoh: 081234567890"
                                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 text-[14px] font-mono font-medium transition-all"
                            />
                            <p className="text-[11px] text-slate-400 mt-2 ml-1">Masukkan nomor WhatsApp yang dipakai saat memesan paket.</p>
                        </div>

                        {/* Upload Zone */}
                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <ImagePlus className="w-4 h-4 text-[#0b411d]" />
                                <h4 className="font-extrabold text-[14px] text-slate-800">Poster Lowongan</h4>
                            </div>
                            <p className="text-[12px] text-slate-400 mb-3">Upload poster HD. Format: JPG, PNG, WebP. Maks 50MB.</p>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={cn(
                                    "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
                                    isDragOver
                                        ? "border-[#0b411d] bg-[#0b411d]/5"
                                        : "border-slate-200 active:border-[#0b411d]/50"
                                )}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                                />
                                <Upload className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p className="text-[13px] font-bold text-slate-600">Tap untuk pilih poster</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">Bisa upload lebih dari 1</p>
                            </div>

                            {/* Preview */}
                            {posterPreviews.length > 0 && (
                                <div className="grid grid-cols-2 gap-2.5 mt-3">
                                    {posterPreviews.map((preview, idx) => (
                                        <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                            <img src={preview} alt={`Poster ${idx + 1}`} className="w-full h-28 object-cover" />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removePosterFile(idx); }}
                                                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Caption */}
                        <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="w-4 h-4 text-[#9a181e]" />
                                <h4 className="font-extrabold text-[14px] text-slate-800">Caption</h4>
                                <span className="text-[11px] text-slate-400">(Opsional)</span>
                            </div>
                            <textarea
                                value={posterCaption}
                                onChange={(e) => setPosterCaption(e.target.value)}
                                placeholder="Tambahkan caption atau catatan..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 text-[14px] resize-none"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Mobile Bottom Bar for Upload Poster */}
                <div className="fixed bottom-0 left-0 right-0 bg-[#0b411d] rounded-t-[2.5rem] px-7 py-5 pb-8 z-50 shadow-[0_-10px_40px_rgba(11,65,29,0.3)]">
                    <button
                        disabled={posterFiles.length === 0 || isUploading || !whatsappNumber.trim()}
                        onClick={handleUploadSubmit}
                        className={cn(
                            "w-full py-3.5 rounded-full font-bold text-[15px] flex justify-center items-center gap-2 transition-all active:scale-[0.97]",
                            posterFiles.length === 0 || isUploading || !whatsappNumber.trim()
                                ? "bg-white/30 text-white/60"
                                : "bg-white text-[#9a181e] shadow-md"
                        )}
                    >
                        {isUploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Mengupload...</>
                        ) : (
                            <><Send className="w-5 h-5" /> Kirim Poster & Selesai</>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}

export default function UploadPosterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <UploadPosterContent />
        </Suspense>
    );
}
