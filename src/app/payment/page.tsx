"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ShieldCheck, Sparkles, User, Phone, Building2, 
    ArrowLeft, ArrowRight, CreditCard, Loader2, 
    CheckCircle2, Copy, MessageCircle, Instagram, Heart, FileText, Download,
    Check
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
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const STEPS = [
    { label: "Pilih Paket", icon: "1" },
    { label: "Data Diri", icon: "2" },
    { label: "Pembayaran", icon: "3" },
];

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
    const [paymentData, setPaymentData] = useState<any>(null);
    
    // Success States
    const [isSuccess, setIsSuccess] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const pkgId = searchParams.get("package");
        if (pkgId && PAYMENT_PACKAGES.find(p => p.id === Number(pkgId))) {
            setSelectedPackage(Number(pkgId));
            setStep(2); // Auto proceed to step 2 if package pre-selected
        }
    }, [searchParams]);

    if (!isClient) return null;

    const pkg = PAYMENT_PACKAGES.find((p) => p.id === selectedPackage);
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
                    }),
                });
                
                const data = await res.json();
                if (data.success && data.data) {
                    setPaymentData(data.data);
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
        setIsSuccess(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    };

    const handlePaymentExpired = () => {
        alert("Waktu pembayaran telah habis. Silakan ulangi pesanan.");
        setStep(1);
        setPaymentData(null);
    };

    const copyOrderId = () => {
        if (paymentData?.order_id) {
            navigator.clipboard.writeText(paymentData.order_id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = async (format: "pdf" | "png") => {
        setIsDownloading(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        alert(`Mendownload invoice format ${format.toUpperCase()}`);
        setIsDownloading(false);
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

                {/* Mobile Success View (Premium Native App Style) */}
                <div className="md:hidden min-h-screen bg-slate-50 flex flex-col relative text-slate-800 font-sans">
                    {/* Header Premium (Soft Dark Green) */}
                    <div className="bg-[#0b411d] pt-10 pb-20 px-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0d5023] rounded-full blur-3xl opacity-50 -translate-y-10 translate-x-10" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#05220f] rounded-full blur-2xl opacity-40 translate-y-10 -translate-x-5" />

                        <div className="flex items-center justify-between relative z-10">
                            <div className="w-10" /> {/* Spacer */}
                            <div className="flex items-center justify-center">
                                <img src="/logo-infoloker.png" alt="Logo" className="h-8 w-auto object-contain drop-shadow-[0_2px_10px_rgba(255,255,255,0.2)]" />
                            </div>
                            <div className="w-10" /> {/* Spacer */}
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-50 rounded-t-[2.5rem] px-5 pt-8 pb-10 w-full flex flex-col items-center relative z-10 shadow-[0_-20px_50px_rgba(0,0,0,0.15)] -mt-10">
                        {/* Success Icon */}
                        <div className="w-20 h-20 bg-[#0b411d] rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-[#0b411d]/30 -mt-16 mb-6 rotate-3 border-4 border-white">
                            <CheckCircle2 className="w-10 h-10 -rotate-3" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">Pembayaran Berhasil!</h2>
                        <p className="text-slate-500 text-sm mb-8 text-center px-4 font-medium">Terima kasih, pesanan Anda telah kami terima dengan baik.</p>

                        <div className="w-full bg-white rounded-[1.5rem] p-5 shadow-[0_5px_20px_-5px_rgba(0,0,0,0.05)] mb-6 border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-slate-400 text-sm font-medium">Order ID</span>
                                <button onClick={copyOrderId} className="flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-md active:scale-95 transition-transform">
                                    <span className="text-slate-800 font-bold text-sm">{orderId}</span>
                                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[#0b411d]" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                                </button>
                            </div>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-slate-400 text-sm font-medium">Paket</span>
                                <span className="text-slate-800 font-bold text-sm bg-slate-50 text-[#0b411d] px-2 py-0.5 rounded-md">{packageName}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-4 mt-2">
                                <span className="text-slate-500 text-sm font-bold">Total Bayar</span>
                                <span className="text-[#9a181e] font-black text-xl">Rp {amount.toLocaleString("id-ID")}</span>
                            </div>
                        </div>

                        <div className="w-full space-y-3 mt-auto pt-4">
                            <a href={waLink} target="_blank" rel="noopener noreferrer" className="block">
                                <Button size="lg" className="w-full rounded-full font-bold bg-[#9a181e] hover:bg-[#7d1318] text-white h-14 shadow-lg shadow-[#9a181e]/20 text-[15px] active:scale-95 transition-transform">
                                    <MessageCircle className="w-5 h-5 mr-2" /> Konfirmasi ke Admin
                                </Button>
                            </a>
                            <Link href="/" className="block">
                                <Button variant="ghost" size="lg" className="w-full rounded-full font-bold h-14 text-slate-500 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-transform">
                                    Kembali ke Beranda
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
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
                                    {PAYMENT_PACKAGES.map((p) => (
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
                                                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full px-4 py-3 rounded-xl border border-border/60 bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm shadow-sm"
                                            />
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
                                    totalAmount={paymentData.total_amount}
                                    qrisImage={paymentData.qris_image}
                                    qrisUrl={paymentData.qris_url}
                                    expiredAt={paymentData.expired_at}
                                    onPaymentSuccess={handlePaymentSuccess}
                                    onPaymentExpired={handlePaymentExpired}
                                />
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
                <div className="bg-[#0b411d] pt-10 pb-16 px-6 relative overflow-hidden">
                    {/* Ambient Glow Kombinasi Merah & Hijau */}
                    <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#9a181e]/40 rounded-full blur-[3rem] pointer-events-none" />
                    <div className="absolute -bottom-20 -left-10 w-56 h-56 bg-[#9a181e]/30 rounded-full blur-[3rem] pointer-events-none" />
                    
                    {/* Top Action Bar */}
                    <div className="flex items-center justify-between relative z-10 mb-2">
                        <button 
                            onClick={handleBack} 
                            disabled={step === 1} 
                            className={cn(
                                "w-10 h-10 flex items-center justify-start transition-opacity", 
                                step === 1 ? "opacity-0 invisible" : "opacity-100"
                            )}
                        >
                            <ArrowLeft className="w-6 h-6 text-white" />
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
                                        {step === 1 ? "1. Pilih Paket" : step === 2 ? "2. Data Diri" : "3. Pembayaran"}
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
                                        {PAYMENT_PACKAGES.map((p) => (
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
                                                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                                                placeholder="08xxxxxxxxxx"
                                                className="w-full pl-12 pr-5 py-4 rounded-[1.25rem] bg-white border border-slate-100 shadow-[0_5px_15px_-5px_rgba(0,0,0,0.05)] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0b411d]/30 focus:border-[#0b411d] font-medium text-[15px] transition-all"
                                            />
                                        </div>
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
