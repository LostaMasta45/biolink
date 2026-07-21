"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ShieldCheck, Sparkles, User, Phone, Building2, 
    ArrowLeft, ArrowRight, CreditCard, Loader2, 
    CheckCircle2, Copy, MessageCircle, FileText,
    Clock, Zap, Home, Upload, X, ImagePlus, Send, SkipForward
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { PackageCard } from "@/components/payment/package-card";
import { AddonToggle } from "@/components/payment/addon-toggle";
import { QrisDisplay } from "@/components/payment/qris-display";
import { StepIndicator } from "@/components/payment/step-indicator";
import { PAYMENT_PACKAGES, PAYMENT_ADDONS } from "@/lib/payment-types";
import { cn } from "@/lib/utils";
import { uploadPoster } from "@/lib/posting-service";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STEPS = [
    { label: "Pilih Paket", icon: "1" },
    { label: "Data Diri", icon: "2" },
    { label: "Pembayaran", icon: "3" },
    { label: "Upload Poster", icon: "4" },
];

const AVAILABLE_PAYMENT_PACKAGES = PAYMENT_PACKAGES.filter((item) => item.isAvailable !== false);

type ActivePayment = {
    order_id: string;
    amount: number;
    total_amount: number;
    qris_url: string | null;
    qris_image: string | null;
    direct_url: string | null;
    signature: string;
    expired_at: string;
    package_name: string;
    addon_names: string[];
    public_token: string;
    upload_token: string;
    package_id: number;
    addons: number[];
    customer_name: string;
    customer_whatsapp: string;
    customer_company: string;
};

function PaymentContent() {
    const searchParams = useSearchParams();
    const [isClient, setIsClient] = useState(false);
    
    // States
    const [step, setStep] = useState(1);
    const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
    const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
    const [customerName, setCustomerName] = useState("");
    const [customerWhatsapp, setCustomerWhatsapp] = useState("");
    const [customerCompany, setCustomerCompany] = useState("");
    
    // Payment States
    const [isLoading, setIsLoading] = useState(false);
    const [paymentData, setPaymentData] = useState<ActivePayment | null>(null);
    
    // Success States
    const [isSuccess, setIsSuccess] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [copied, setCopied] = useState(false);

    // Upload Poster States (Step 4)
    const [posterFiles, setPosterFiles] = useState<File[]>([]);
    const [posterPreviews, setPosterPreviews] = useState<string[]>([]);
    const [posterCaption, setPosterCaption] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const paymentAttemptRef = useRef<string | null>(null);

    useEffect(() => {
        setIsClient(true);
        let hasActivePayment = false;

        // Restore form data
        const savedForm = localStorage.getItem("ilj_payment_form_v2");
        if (savedForm) {
            try {
                const parsed = JSON.parse(savedForm);
                const isFresh = parsed.schemaVersion === 2 && Date.now() - Number(parsed.updatedAt || 0) < 30 * 24 * 60 * 60 * 1000;
                if (isFresh) {
                    if (parsed.customerName) setCustomerName(parsed.customerName);
                    if (parsed.customerWhatsapp) setCustomerWhatsapp(parsed.customerWhatsapp);
                    if (parsed.customerCompany) setCustomerCompany(parsed.customerCompany);
                    if (parsed.selectedPackage) setSelectedPackage(parsed.selectedPackage);
                    if (parsed.selectedAddons) setSelectedAddons(parsed.selectedAddons);
                } else localStorage.removeItem("ilj_payment_form_v2");
            } catch {}
        }

        // Restore payment data
        const savedPayment = localStorage.getItem("ilj_active_payment_v2");
        if (savedPayment) {
            try {
                const parsedPayment = JSON.parse(savedPayment);
                const expiry = new Date(parsedPayment.expired_at).getTime();
                if (expiry > Date.now()) {
                    setPaymentData(parsedPayment as ActivePayment);
                    setStep(3);
                    hasActivePayment = true;
                } else {
                    localStorage.removeItem("ilj_active_payment_v2");
                }
            } catch {}
        }

        const pkgId = searchParams.get("package");
        if (pkgId && AVAILABLE_PAYMENT_PACKAGES.find(p => p.id === Number(pkgId))) {
            setSelectedPackage(Number(pkgId));
            if (!hasActivePayment) setStep(2); // Auto proceed to step 2 if package pre-selected
        }
    }, [searchParams]);

    useEffect(() => {
        paymentAttemptRef.current = null;
    }, [customerName, customerWhatsapp, customerCompany, selectedPackage, selectedAddons]);

    // Save form data to cache
    useEffect(() => {
        if (!isClient) return;
        const timeout = window.setTimeout(() => localStorage.setItem("ilj_payment_form_v2", JSON.stringify({
            schemaVersion: 2,
            updatedAt: Date.now(),
            customerName,
            customerWhatsapp,
            customerCompany,
            selectedPackage,
            selectedAddons
        })), 350);
        return () => window.clearTimeout(timeout);
    }, [customerName, customerWhatsapp, customerCompany, selectedPackage, selectedAddons, isClient]);

    // Save payment data to cache
    useEffect(() => {
        if (!isClient) return;
        if (paymentData) {
            localStorage.setItem("ilj_active_payment_v2", JSON.stringify({ ...paymentData, savedAt: Date.now() }));
        } else {
            localStorage.removeItem("ilj_active_payment_v2");
        }
    }, [paymentData, isClient]);

    if (!isClient) return null;

    const pkg = AVAILABLE_PAYMENT_PACKAGES.find((p) => p.id === selectedPackage);
    const addonsTotal = PAYMENT_ADDONS.filter(a => selectedAddons.includes(a.id)).reduce((acc, curr) => acc + curr.price, 0);
    const totalPrice = (pkg?.price || 0) + addonsTotal;
    const canProceed = step === 1 ? !!selectedPackage : (customerName.trim() !== "" && customerWhatsapp.trim() !== "" && customerCompany.trim() !== "");

    const toggleAddon = (id: number) => {
        setSelectedAddons(prev => 
            prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
        );
    };

    const handleNext = async () => {
        if (step === 1 && canProceed) {
            setStep(2);
        } else if (step === 2 && canProceed) {
            // Reuse active payment if valid and order details haven't changed
            if (paymentData) {
                const expiry = new Date(paymentData.expired_at).getTime();
                if (expiry > Date.now()) {
                    const isSamePackage = paymentData.package_id === selectedPackage;
                    const isSameAddons = JSON.stringify(paymentData.addons) === JSON.stringify(selectedAddons);
                    const isSameCustomer = paymentData.customer_whatsapp === customerWhatsapp && paymentData.customer_name === customerName && paymentData.customer_company === customerCompany;
                    if (isSamePackage && isSameAddons && isSameCustomer) {
                        setStep(3);
                        return;
                    }
                }
            }

            setIsLoading(true);
            try {
                const res = await fetch("/api/payment/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customer_name: customerName,
                        customer_whatsapp: customerWhatsapp,
                        customer_company: customerCompany,
                        package_id: selectedPackage,
                        addons: selectedAddons,
                        idempotency_key: paymentAttemptRef.current || (paymentAttemptRef.current = crypto.randomUUID()),
                    }),
                });
                
                const data = await res.json();
                if (data.success && data.data) {
                    const paymentToSave: ActivePayment = {
                        ...data.data,
                        package_id: selectedPackage,
                        addons: selectedAddons,
                        customer_name: customerName,
                        customer_whatsapp: customerWhatsapp,
                        customer_company: customerCompany,
                    };
                    setPaymentData(paymentToSave);
                    setStep(3);
                } else {
                    throw new Error(data.error || "Gagal membuat pembayaran");
                }
            } catch (error) {
                console.error("Payment error", error);
                alert(error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pembayaran");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handlePaymentSuccess = () => {
        // Instead of showing success, go to Step 4 (Upload Poster)
        setStep(4);
    };

    // File handling for poster upload
    const handleFileSelect = (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        fileArray.slice(0, Math.max(0, 10 - posterFiles.length)).forEach(file => {
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
                    order_id: paymentData?.order_id,
                    upload_token: paymentData?.upload_token,
                    poster_urls: uploadedUrls,
                    caption: posterCaption || undefined,
                }),
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || "Gagal menyimpan data poster");
            }

            // Clean up previews
            posterPreviews.forEach(url => URL.revokeObjectURL(url));

            // Clear payment cache
            localStorage.removeItem("ilj_active_payment_v2");
            localStorage.removeItem("ilj_payment_form_v2");

            // Show success
            setIsSuccess(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        } catch (error) {
            console.error("Upload error:", error);
            alert(error instanceof Error ? error.message : "Terjadi kesalahan saat upload poster");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSkipUpload = async () => {
        setIsUploading(true);
        try {
            const response = await fetch("/api/payment/defer-poster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ order_id: paymentData?.order_id, upload_token: paymentData?.upload_token }),
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || "Status unggah nanti tidak dapat disimpan");
            localStorage.removeItem("ilj_active_payment_v2");
            localStorage.removeItem("ilj_payment_form_v2");
            setIsSuccess(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        } catch (error) {
            alert(error instanceof Error ? error.message : "Coba lagi untuk menyimpan pilihan unggah nanti");
        } finally {
            setIsUploading(false);
        }
    };

    const handlePaymentExpired = () => {
        alert("Waktu pembayaran telah habis. Silakan ulangi pesanan.");
        localStorage.removeItem("ilj_active_payment_v2");
        setStep(2);
        setPaymentData(null);
    };

    const copyOrderId = () => {
        if (paymentData?.order_id) {
            navigator.clipboard.writeText(paymentData.order_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Calculate details for success page
    const orderId = paymentData?.order_id || "ILJ-XXXXX";
    const packageName = pkg?.name || "";
    const amount = paymentData?.total_amount || 0;
    const waText = encodeURIComponent(`Halo min, saya sudah transfer untuk pesanan ${orderId}.\n\nPaket: ${packageName}\nNama: ${customerName}\nPerusahaan: ${customerCompany}\n\nBerikut bukti transfer & materi lowongannya:`);
    const waLink = `https://wa.me/6281234567890?text=${waText}`;

    if (isSuccess) {
        return (
            <>
                {/* Desktop Success View */}
                <div className="hidden md:block min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden transition-colors duration-300">
                    {/* Confetti Animation */}
                    {showConfetti && (
                        <div className="fixed inset-0 z-50 pointer-events-none">
                            {Array.from({ length: 50 }).map((_, i) => (
                                <motion.div
                                    key={i}
                                    initial={{
                                        opacity: 1,
                                        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 400),
                                        y: -20,
                                        rotate: 0,
                                        scale: Math.random() * 0.5 + 0.5,
                                    }}
                                    animate={{
                                        opacity: 0,
                                        y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 100,
                                        rotate: Math.random() * 720 - 360,
                                    }}
                                    transition={{
                                        duration: Math.random() * 2 + 2,
                                        delay: Math.random() * 1,
                                        ease: "easeOut",
                                    }}
                                    className="absolute w-3 h-3 rounded-sm"
                                    style={{
                                        backgroundColor: [
                                            "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
                                            "#ec4899", "#06b6d4", "#f97316",
                                        ][i % 8],
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Header */}
                    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
                        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                    <span className="text-white font-bold text-[10px]">ILJ</span>
                                </div>
                                <div>
                                    <h1 className="font-bold text-sm text-foreground leading-none">
                                        infolokerjombang
                                    </h1>
                                    <p className="text-[10px] text-emerald-500 font-semibold">Pembayaran Berhasil</p>
                                </div>
                            </div>
                            <ModeToggle />
                        </div>
                    </header>

                    <main className="max-w-2xl mx-auto px-4 py-8">
                        {/* Success Icon */}
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                            className="flex justify-center mb-6"
                        >
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl scale-150" />
                                <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full p-5 shadow-2xl shadow-emerald-500/40">
                                    <CheckCircle2 className="w-14 h-14 text-white" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Title */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="text-center mb-8"
                        >
                            <h1 className="text-3xl font-extrabold text-foreground mb-2">
                                Terima Kasih! 🎉
                            </h1>
                            <p className="text-muted-foreground">
                                Pembayaran Anda telah berhasil diterima
                            </p>
                        </motion.div>

                        {/* Order Details Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Card className="p-6 mb-6 border-emerald-500/20 bg-emerald-500/5">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Order ID</span>
                                        <button onClick={copyOrderId} className="flex items-center gap-2 text-sm font-mono font-bold text-foreground hover:text-primary transition-colors">
                                            {orderId}
                                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                                        </button>
                                    </div>
                                    <div className="border-t border-border/50" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Nama</span>
                                        <span className="text-sm font-semibold text-foreground">{customerName}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Perusahaan</span>
                                        <span className="text-sm font-semibold text-foreground">{customerCompany}</span>
                                    </div>
                                    <div className="border-t border-border/50" />
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Paket</span>
                                        <span className="text-sm font-semibold text-foreground">{packageName}</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl p-3 -mx-1">
                                        <span className="font-bold text-foreground">Total Bayar</span>
                                        <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                            Rp {amount.toLocaleString("id-ID")}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* Next Steps & Actions */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="space-y-6"
                        >
                            <Card className="p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <h3 className="font-bold text-foreground">Langkah Selanjutnya</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-primary">1</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Konfirmasi via WhatsApp</p>
                                            <p className="text-xs text-muted-foreground">Kirim bukti pembayaran dan detail loker ke admin</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <span className="text-xs font-bold text-primary">2</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Kirim Materi Lowongan</p>
                                            <p className="text-xs text-muted-foreground">Kirimkan poster / detail lowongan kerja yang ingin diposting</p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <div className="space-y-3">
                                <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                                    <Button size="lg" className="w-full rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 text-white shadow-lg shadow-emerald-500/30 h-12">
                                        <MessageCircle className="w-5 h-5 mr-2" /> Konfirmasi via WhatsApp
                                    </Button>
                                </a>
                                <Link href="/" className="block">
                                    <Button variant="ghost" size="lg" className="w-full rounded-xl font-semibold h-12 text-muted-foreground">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Beranda
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    </main>
                </div>

                {/* Mobile Success View (Premium Native App Style - Green E-Wallet) */}
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
                                <span className="text-xl font-black text-slate-800">Rp {amount.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-xs font-medium">Tanggal</span>
                                    <span className="text-slate-700 text-xs font-bold">{new Date().toLocaleString('id-ID', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'})} WIB</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-xs font-medium">Paket</span>
                                    <span className="text-slate-700 text-xs font-bold">{packageName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-xs font-medium">ID Transaksi</span>
                                    <button onClick={copyOrderId} className="flex items-center gap-1.5 active:scale-95 transition-transform">
                                        <span className="text-slate-700 text-xs font-mono font-bold bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">{orderId}</span>
                                        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#00a550]" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                        
                        {/* Action Buttons */}
                        <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                            className="w-full space-y-3 mt-auto"
                        >
                            <Link href={waLink} target="_blank" className="w-full bg-[#00a550] hover:bg-[#008c44] text-white py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-all">
                                <MessageCircle className="w-5 h-5" /> Konfirmasi ke Admin
                            </Link>
                            <Link href="/" className="w-full bg-emerald-50 hover:bg-emerald-100 text-[#00a550] py-4 rounded-2xl font-bold text-[15px] flex justify-center items-center gap-2 active:scale-[0.98] transition-all">
                                <Home className="w-5 h-5" /> Kembali ke Beranda
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>
            </>
        );
    }

    return (
        <>
            {/* ========================================================
                DESKTOP VIEW (Match Original UI exactly)
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
                        <div className="flex items-center gap-3">
                            <img 
                                src="/logo-infoloker.png" 
                                alt="ILJ Logo" 
                                className="h-9 sm:h-10 w-auto object-contain drop-shadow-sm shrink-0"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                            <span className="hidden font-black text-slate-400 text-xs shrink-0">ILJ</span>
                            <div>
                                <h1 className="font-extrabold text-sm text-foreground leading-none tracking-tight hidden sm:block">
                                    infolokerjombang
                                </h1>
                                <p className="text-[10px] text-muted-foreground mt-0.5 font-bold tracking-wide uppercase flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Secure Payment
                                </p>
                            </div>
                        </div>
                        <ModeToggle />
                    </div>
                </header>

                {/* Desktop View Content */}
                <main className="max-w-3xl mx-auto px-4 py-6 pb-32">
                    {/* Step Indicator */}
                    <div className="mb-8">
                        <StepIndicator currentStep={step} steps={STEPS} />
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ======= STEP 1: Pilih Paket ======= */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                {/* Title */}
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                                        Pilih Paket
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                                        Pilih paket yang sesuai untuk lowongan kerja Anda
                                    </p>
                                </div>

                                {/* Package Cards */}
                                <motion.div 
                                    variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                                    initial="hidden" animate="show"
                                    className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8"
                                >
                                    {AVAILABLE_PAYMENT_PACKAGES.map((p) => (
                                        <motion.div
                                            key={p.id}
                                            variants={{
                                                hidden: { opacity: 0, y: 20 },
                                                show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
                                            }}
                                        >
                                            <PackageCard pkg={p} selected={selectedPackage === p.id} onSelect={setSelectedPackage} />
                                        </motion.div>
                                    ))}
                                </motion.div>

                                {/* Add-ons Section */}
                                <motion.div 
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="mb-6"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        <h3 className="font-bold text-foreground">Tambahan (Opsional)</h3>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {PAYMENT_ADDONS.map((addon) => (
                                            <AddonToggle key={addon.id} addon={addon} selected={selectedAddons.includes(addon.id)} onToggle={toggleAddon} />
                                        ))}
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* ======= STEP 2: Data Diri & Ringkasan ======= */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="max-w-xl mx-auto space-y-6">
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                                            Data Pemesan
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                                            Lengkapi data berikut untuk keperluan invoice dan konfirmasi
                                        </p>
                                    </div>

                                    <Card className="p-6 space-y-5 bg-card/40 backdrop-blur-md shadow-lg shadow-black/5 dark:shadow-white/5 border-border/40">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
                                                <User className="w-3.5 h-3.5 text-blue-500" /> Nama Lengkap
                                            </label>
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="Masukkan nama Anda"
                                                className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm shadow-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
                                                <Phone className="w-3.5 h-3.5 text-emerald-500" /> Nomor WhatsApp
                                            </label>
                                            <input
                                                type="tel"
                                                value={customerWhatsapp}
                                                onChange={(e) => setCustomerWhatsapp(e.target.value.replace(/[^0-9+]/g, ''))}
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm shadow-sm"
                                            />
                                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                                Gunakan nomor WhatsApp yang sebelumnya dipakai untuk chat admin agar data pesanan mudah kami cocokkan.
                                            </p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-blue-500" /> Nama Perusahaan / Usaha
                                            </label>
                                            <input
                                                type="text"
                                                value={customerCompany}
                                                onChange={(e) => setCustomerCompany(e.target.value)}
                                                placeholder="PT / CV / Toko / Usaha..."
                                                className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm shadow-sm"
                                            />
                                        </div>
                                    </Card>

                                    {/* Order Summary */}
                                    <Card className="p-6 bg-muted/30 border-dashed border-border/60 shadow-inner">
                                        <h4 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" /> Ringkasan Pesanan
                                        </h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="flex justify-between items-center bg-background/50 p-2.5 rounded-lg">
                                                <span className="text-muted-foreground font-medium">{pkg?.name}</span>
                                                <span className="font-semibold text-foreground">Rp {(pkg?.price || 0).toLocaleString("id-ID")}</span>
                                            </div>
                                            {PAYMENT_ADDONS
                                                .filter((a) => selectedAddons.includes(a.id))
                                                .map((addon) => (
                                                    <div key={addon.id} className="flex justify-between items-center bg-background/50 p-2.5 rounded-lg">
                                                        <span className="text-muted-foreground flex items-center gap-2">
                                                            <span>{addon.emoji}</span> {addon.name}
                                                        </span>
                                                        <span className="font-semibold text-foreground">Rp {addon.price.toLocaleString("id-ID")}</span>
                                                    </div>
                                                ))}
                                            <div className="border-t border-border pt-4 mt-4 flex justify-between items-center">
                                                <span className="font-bold text-foreground">Total Tagihan</span>
                                                <span className="font-extrabold text-primary text-xl">
                                                    Rp {totalPrice.toLocaleString("id-ID")}
                                                </span>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </motion.div>
                        )}

                        {/* ======= STEP 3: Bayar QRIS ======= */}
                        {step === 3 && paymentData && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-extrabold text-foreground">
                                        Scan & Bayar
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Scan QR code dengan e-wallet atau m-banking Anda
                                    </p>
                                </div>

                                <QrisDisplay
                                    orderId={paymentData.order_id}
                                    accessToken={paymentData.public_token}
                                    totalAmount={paymentData.total_amount}
                                    qrisImage={paymentData.qris_image}
                                    qrisUrl={paymentData.qris_url}
                                    expiredAt={paymentData.expired_at}
                                    onPaymentSuccess={handlePaymentSuccess}
                                    onPaymentExpired={handlePaymentExpired}
                                />
                            </motion.div>
                        )}

                        {/* ======= STEP 4: Upload Poster ======= */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <div className="max-w-xl mx-auto space-y-6">
                                    <div className="text-center mb-6">
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", bounce: 0.5 }}
                                            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30"
                                        >
                                            <CheckCircle2 className="w-8 h-8 text-white" />
                                        </motion.div>
                                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
                                            Pembayaran Berhasil! 🎉
                                        </h2>
                                        <p className="text-sm text-muted-foreground mt-1.5 font-medium">
                                            Sekarang upload poster lowongan Anda
                                        </p>
                                    </div>

                                    {/* Upload Area */}
                                    <Card className="p-6 bg-card/40 backdrop-blur-md shadow-lg border-border/40">
                                        <div className="flex items-center gap-2 mb-4">
                                            <ImagePlus className="w-4 h-4 text-primary" />
                                            <h3 className="font-bold text-foreground">Upload Poster Lowongan</h3>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Upload poster HD (tanpa kompresi). Format: JPG, PNG, WebP. Maks 50MB per file.
                                        </p>

                                        {/* Drop Zone */}
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

                                        {/* Preview Grid */}
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

                                    {/* Caption */}
                                    <Card className="p-6 bg-card/40 backdrop-blur-md shadow-lg border-border/40">
                                        <div className="flex items-center gap-2 mb-3">
                                            <FileText className="w-4 h-4 text-primary" />
                                            <h3 className="font-bold text-foreground">Caption / Catatan</h3>
                                            <span className="text-xs text-muted-foreground">(Opsional)</span>
                                        </div>
                                        <textarea
                                            value={posterCaption}
                                            onChange={(e) => setPosterCaption(e.target.value)}
                                            placeholder="Tambahkan caption atau catatan untuk posting (opsional)..."
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm shadow-sm resize-none"
                                        />
                                    </Card>

                                    {/* Action Buttons */}
                                    <div className="space-y-3 pt-2">
                                        <Button
                                            size="lg"
                                            disabled={posterFiles.length === 0 || isUploading}
                                            onClick={handleUploadSubmit}
                                            className="w-full rounded-xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 h-12"
                                        >
                                            {isUploading ? (
                                                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Mengupload...</>
                                            ) : (
                                                <><Send className="w-5 h-5 mr-2" /> Kirim Poster & Selesai</>
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="lg"
                                            disabled={isUploading}
                                            onClick={handleSkipUpload}
                                            className="w-full rounded-xl font-semibold h-12 text-muted-foreground"
                                        >
                                            <SkipForward className="w-4 h-4 mr-2" /> Lewati, Kirim Poster Nanti
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </main>

                {/* Desktop Bottom Action Bar */}
                {step < 3 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 p-4 z-50 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.3)]">
                        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                            <div>
                                {selectedPackage && (
                                    <div className="flex flex-col">
                                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-0.5">Total Pembayaran</p>
                                        <div className="flex items-start gap-1">
                                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Rp</span>
                                            <span className="text-3xl font-medium text-slate-800 dark:text-slate-100">
                                                {totalPrice.toLocaleString("id-ID")}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {step > 1 && (
                                    <Button variant="outline" size="lg" onClick={handleBack} className="rounded-xl px-6">
                                        <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
                                    </Button>
                                )}
                                <Button
                                    size="lg"
                                    disabled={!canProceed || isLoading}
                                    onClick={handleNext}
                                    className={cn(
                                        "rounded-xl font-bold min-w-[160px] shadow-sm",
                                        step === 2 ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-emerald-500/20" : ""
                                    )}
                                >
                                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...</> : step === 2 ? <><CreditCard className="w-4 h-4 mr-2" /> Bayar Sekarang</> : <><ArrowRight className="w-4 h-4 mr-2" /> Lanjutkan</>}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================
                MOBILE VIEW (Premium Native App Style with Soft Dark Palette)
                ======================================================== */}
            <div className="md:hidden min-h-screen bg-slate-50 flex flex-col relative text-slate-800 font-sans">
                {/* Mobile Premium Header (True Native Mobile Style) */}
                <div className="bg-[#0b411d] pt-10 pb-24 px-6 relative overflow-hidden">
                    {/* Ambient Glow Kombinasi Merah & Hijau */}
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#9a181e]/40 rounded-full blur-[3rem] pointer-events-none" />
                    <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-[#9a181e]/30 rounded-full blur-[3rem] pointer-events-none" />
                    
                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between relative z-50 mb-2 mt-2">
                        <button 
                            onClick={handleBack} 
                            disabled={step === 1} 
                            className={cn(
                                "w-10 h-10 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full border border-white/10 transition-all active:scale-95", 
                                step === 1 ? "opacity-0 invisible" : "opacity-100"
                            )}
                        >
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </button>
                        
                        <div className="w-10" /> {/* Spacer */}
                    </div>
                </div>

                {/* Mobile Content Area (White Rounded Top Overlapping Header) */}
                <div className="flex-1 bg-[#f8fafc] rounded-t-[2.5rem] px-5 pb-32 w-full flex flex-col relative z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] -mt-12">
                    
                    {/* SPACER to prevent overlap: Reserves physical space for the absolute floating card */}
                    <div className="w-full h-[190px] shrink-0" />

                    {/* TRUE Native Floating Card Wrapper (Absolute positioning) */}
                    <div className="absolute left-5 right-5 z-30" style={{ top: '-40px' }}>
                        
                        {/* Red Card Background (Rendered First) */}
                        <div 
                            className="w-full rounded-[1.5rem] p-5 pt-12 shadow-[0_20px_40px_-10px_rgba(154,24,30,0.4)] border border-white/20 flex flex-col relative overflow-hidden"
                            style={{ background: 'linear-gradient(135deg, #9a181e 0%, #630c10 100%)' }}
                        >
                            {/* Decorative background blurs inside card */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-10 translate-x-10 pointer-events-none z-0" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full blur-xl translate-y-5 -translate-x-5 pointer-events-none z-0" />

                            <div className="text-center mb-6 relative z-10">
                                <h1 className="font-black text-[22px] text-white tracking-tight leading-none mb-2 drop-shadow-md">InfoLokerJombang</h1>
                                <div className="inline-flex items-center justify-center gap-1.5 bg-white/15 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/20 shadow-sm">
                                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Premium Portal</span>
                                </div>
                            </div>

                            {/* Additional Items: Step Progress & Total */}
                            <div className="flex items-center justify-between bg-black/25 rounded-[1rem] p-3.5 border border-white/10 backdrop-blur-md relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-white/70 text-[10px] uppercase tracking-widest font-bold mb-1">Status</span>
                                    <span className="text-white font-bold text-[13px]">
                                        {step === 1 ? "1. Pilih Paket" : step === 2 ? "2. Data Diri" : step === 3 ? "3. Pembayaran" : "4. Upload Poster"}
                                    </span>
                                </div>
                                <div className="w-px h-8 bg-white/20 mx-2" />
                                <div className="flex flex-col text-right">
                                    <span className="text-white/70 text-[10px] uppercase tracking-widest font-bold mb-1">Total Tagihan</span>
                                    <span className="font-black text-[16px] text-white tracking-tight leading-none mt-0.5">Rp {totalPrice.toLocaleString("id-ID")}</span>
                                </div>
                            </div>
                        </div>

                        {/* Logo bursting out of the top (Rendered Last, guaranteed on top) */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#f8fafc] p-1.5 rounded-[1.25rem] shadow-lg z-50">
                            <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-inner">
                                <img src="/logo-infoloker.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            </div>
                        </div>
                    </div>
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div key="step1-mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="mb-8 px-1">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 rounded-md bg-[#0b411d]/10 flex items-center justify-center">
                                            <ShieldCheck className="w-4 h-4 text-[#0b411d]" />
                                        </div>
                                        <h2 className="font-extrabold text-slate-800 text-[16px] tracking-tight">Paket Tersedia</h2>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3.5">
                                        {AVAILABLE_PAYMENT_PACKAGES.map((p) => (
                                            <PackageCard key={p.id} pkg={p} selected={selectedPackage === p.id} onSelect={setSelectedPackage} />
                                        ))}
                                    </div>
                                </div>

                                <div className="mb-6 px-1">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 rounded-md bg-[#9a181e]/10 flex items-center justify-center">
                                            <Sparkles className="w-4 h-4 text-[#9a181e]" />
                                        </div>
                                        <h2 className="font-extrabold text-slate-800 text-[16px] tracking-tight">Tambahan <span className="text-slate-400 font-medium text-sm">(Opsional)</span></h2>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3.5">
                                        {PAYMENT_ADDONS.map((addon) => (
                                            <AddonToggle key={addon.id} addon={addon} selected={selectedAddons.includes(addon.id)} onToggle={toggleAddon} />
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div key="step2-mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-1 space-y-6">
                                <div className="space-y-4">
                                    <div className="relative">
                                        <label className="block text-[12px] font-extrabold text-slate-500 mb-2 ml-1 uppercase tracking-wider">Nama Lengkap</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <User className="w-5 h-5 text-[#0b411d]/50" />
                                            </div>
                                            <input
                                                type="text"
                                                value={customerName}
                                                onChange={(e) => setCustomerName(e.target.value)}
                                                placeholder="Masukkan nama Anda"
                                                className="w-full pl-12 pr-5 py-4 rounded-[1.25rem] bg-white border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 focus:border-[#0b411d] font-medium text-[15px] transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[12px] font-extrabold text-slate-500 mb-2 ml-1 uppercase tracking-wider">Nomor WhatsApp</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Phone className="w-5 h-5 text-[#0b411d]/50" />
                                            </div>
                                            <input
                                                type="tel"
                                                value={customerWhatsapp}
                                                onChange={(e) => setCustomerWhatsapp(e.target.value.replace(/[^0-9+]/g, ''))}
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full pl-12 pr-5 py-4 rounded-[1.25rem] bg-white border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 focus:border-[#0b411d] font-medium text-[15px] transition-all"
                                            />
                                        </div>
                                        <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-400">Gunakan nomor WhatsApp yang sebelumnya dipakai untuk chat admin agar data pesanan mudah kami cocokkan.</p>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[12px] font-extrabold text-slate-500 mb-2 ml-1 uppercase tracking-wider">Nama Perusahaan / Usaha</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <Building2 className="w-5 h-5 text-[#0b411d]/50" />
                                            </div>
                                            <input
                                                type="text"
                                                value={customerCompany}
                                                onChange={(e) => setCustomerCompany(e.target.value)}
                                                placeholder="PT / CV / Toko / Usaha..."
                                                className="w-full pl-12 pr-5 py-4 rounded-[1.25rem] bg-white border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 focus:border-[#0b411d] font-medium text-[15px] transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[1.5rem] p-5 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100">
                                    <h4 className="font-extrabold text-[14px] text-slate-800 mb-4 flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-[#9a181e]" /> Ringkasan Pesanan
                                    </h4>
                                    <div className="space-y-3.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium text-[14px]">{pkg?.name}</span>
                                            <span className="font-bold text-slate-800">Rp {(pkg?.price || 0).toLocaleString("id-ID")}</span>
                                        </div>
                                        {PAYMENT_ADDONS.filter((a) => selectedAddons.includes(a.id)).map((addon) => (
                                            <div key={addon.id} className="flex justify-between items-center">
                                                <span className="text-slate-500 font-medium text-[13px] flex items-center gap-1.5">
                                                    <span>{addon.emoji}</span> {addon.name}
                                                </span>
                                                <span className="font-bold text-slate-800">Rp {addon.price.toLocaleString("id-ID")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && paymentData && (
                            <motion.div key="step3-mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <div className="bg-white rounded-[1.5rem] p-6 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] border border-slate-100">
                                    <QrisDisplay
                                        orderId={paymentData.order_id}
                                        accessToken={paymentData.public_token}
                                        totalAmount={paymentData.total_amount}
                                        qrisImage={paymentData.qris_image}
                                        qrisUrl={paymentData.qris_url}
                                        expiredAt={paymentData.expired_at}
                                        onPaymentSuccess={handlePaymentSuccess}
                                        onPaymentExpired={handlePaymentExpired}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4 Mobile: Upload Poster */}
                        {step === 4 && (
                            <motion.div key="step4-mobile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-1 space-y-5">
                                {/* Success Badge */}
                                <div className="text-center">
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", bounce: 0.5 }}
                                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30"
                                    >
                                        <CheckCircle2 className="w-7 h-7 text-white" />
                                    </motion.div>
                                    <h3 className="font-black text-[18px] text-slate-800 tracking-tight">Pembayaran Berhasil! 🎉</h3>
                                    <p className="text-slate-500 text-[13px] font-medium mt-1">Upload poster lowongan Anda</p>
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
                        )}
                    </AnimatePresence>
                </div>

                {/* Mobile Bottom Action Bar (Matching Reference Image) */}
                {step < 3 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-[#0b411d] rounded-t-[2.5rem] px-7 py-6 pb-8 z-50 shadow-[0_-10px_40px_rgba(11,65,29,0.3)]">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-[22px] font-bold text-white leading-none tracking-tight">
                                    Rp {(totalPrice).toLocaleString("id-ID")}
                                </span>
                                <span className="text-white/80 text-[12px] font-medium mt-1">Total Tagihan</span>
                            </div>
                            <Button
                                size="lg"
                                disabled={!canProceed || isLoading}
                                onClick={handleNext}
                                className={cn(
                                    "rounded-full font-bold px-7 h-12 bg-white text-[#9a181e] hover:bg-slate-100 shadow-md text-[15px] transition-transform active:scale-95",
                                    (!canProceed || isLoading) && "opacity-80"
                                )}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : step === 2 ? "Pay Now →" : "Lanjutkan →"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Bar for Step 4 (Upload Poster) */}
                {step === 4 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-[#0b411d] rounded-t-[2.5rem] px-7 py-5 pb-8 z-50 shadow-[0_-10px_40px_rgba(11,65,29,0.3)]">
                        <div className="flex flex-col gap-2.5">
                            <button
                                disabled={posterFiles.length === 0 || isUploading}
                                onClick={handleUploadSubmit}
                                className={cn(
                                    "w-full py-3.5 rounded-full font-bold text-[15px] flex justify-center items-center gap-2 transition-all active:scale-[0.97]",
                                    posterFiles.length === 0 || isUploading
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
                            <button
                                disabled={isUploading}
                                onClick={handleSkipUpload}
                                className="w-full py-2.5 text-white/70 font-medium text-[13px] flex justify-center items-center gap-1.5 active:text-white transition-colors"
                            >
                                <SkipForward className="w-4 h-4" /> Lewati, Kirim Poster Nanti
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <PaymentContent />
        </Suspense>
    );
}
