"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, CheckCircle2, ChevronRight, Briefcase, Search, Star, User } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstallPrompt } from "@/components/pwa";

// --- Components ---

function FormLoader() {
    return (
        <div className="flex space-x-2 justify-center items-center">
            <motion.div
                className="h-2 w-2 bg-white rounded-full"
                animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
            />
            <motion.div
                className="h-2 w-2 bg-white rounded-full"
                animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
            />
            <motion.div
                className="h-2 w-2 bg-white rounded-full"
                animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            />
        </div>
    );
}

function IllustrationPanel() {
    return (
        <div className="hidden md:flex flex-1 bg-emerald-50 relative overflow-hidden items-center justify-center p-12">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, #047857 1px, transparent 0)',
                    backgroundSize: '32px 32px'
                }}
            />

            {/* Decorative Blobs */}
            <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-20 right-20 w-64 h-64 bg-emerald-200/50 rounded-full blur-3xl"
            />
            <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 0] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-20 left-20 w-80 h-80 bg-teal-200/50 rounded-full blur-3xl"
            />

            {/* Illustration Mockup */}
            <div className="relative z-10 w-full max-w-md aspect-square">
                {/* Central Image/Character */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="absolute inset-0 flex items-center justify-center"
                >
                    <div className="relative w-64 h-64 bg-white rounded-full shadow-2xl flex items-center justify-center overflow-hidden border-4 border-white">
                        <div className="absolute inset-0 bg-gradient-to-b from-emerald-100 to-emerald-50" />
                        <User className="w-32 h-32 text-emerald-600/20 absolute -bottom-4" />
                        <Briefcase className="w-16 h-16 text-emerald-600 relative z-10 drop-shadow-lg" />
                    </div>
                </motion.div>

                {/* Floating Cards */}
                <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="absolute top-[20%] left-0 bg-white p-4 rounded-2xl shadow-xl border border-emerald-100/50 flex items-center gap-3 w-48"
                >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-800">Job Match</div>
                        <div className="text-[10px] text-slate-400">95% Compatibility</div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="absolute bottom-[20%] right-0 bg-white p-4 rounded-2xl shadow-xl border border-emerald-100/50 flex items-center gap-3 w-48"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Search className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-slate-800">New Success</div>
                        <div className="text-[10px] text-slate-400">Hired 5 mins ago</div>
                    </div>
                </motion.div>

                {/* Text Bottom */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="absolute -bottom-12 left-0 right-0 text-center"
                >
                    <h3 className="text-xl font-bold text-slate-800">Make your career move</h3>
                    <p className="text-slate-500 text-sm mt-1">Easier and organized with InfoLoker</p>
                </motion.div>
            </div>
        </div>
    );
}

// --- Views ---

function WelcomeView({ onStart }: { onStart: () => void }) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.5 }}
            className="flex flex-col h-full relative z-10 text-white overflow-hidden w-full md:max-w-md md:mx-auto md:h-auto md:min-h-[600px] md:rounded-3xl md:shadow-2xl"
        >
            {/* Background Animation Layer */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-600 via-primary to-emerald-950" />

                {/* Animated Orbs */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                        x: [0, 50, 0],
                        y: [0, -30, 0]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[-10%] right-[-20%] w-[400px] h-[400px] bg-emerald-400 rounded-full blur-[100px] mix-blend-overlay"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.3, 0.6, 0.3],
                        x: [0, -30, 0],
                        y: [0, 40, 0]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute bottom-[-10%] left-[-20%] w-[500px] h-[500px] bg-teal-400 rounded-full blur-[120px] mix-blend-overlay"
                />

                {/* Noise Texture */}
                <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
            </div>

            {/* Content Container */}
            <div className="relative z-10 flex-1 flex flex-col justify-between p-8 pt-16">

                {/* Top Section */}
                <div className="flex flex-col items-center space-y-8">
                    <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.2
                        }}
                        className="relative"
                    >
                        {/* Logo Container with Glass Effect */}
                        <div className="w-28 h-28 bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-900/40 relative z-20">
                            <Image
                                src="/icon.png"
                                alt="Logo"
                                width={80}
                                height={80}
                                className="object-contain drop-shadow-md"
                                priority
                            />
                        </div>

                        {/* Decorative floating elements behind logo */}
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-4 border border-white/10 rounded-[2.5rem] z-10"
                        />
                        <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-8 border border-white/5 rounded-[3rem] z-0 dashed-border"
                        />
                    </motion.div>

                    <div className="text-center space-y-4 max-w-xs mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <h2 className="text-xs font-bold tracking-[0.2em] text-emerald-200 uppercase mb-2">Welcome to</h2>
                            <h1 className="text-4xl font-black tracking-tight text-white leading-tight">
                                InfoLoker <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-100">Jombang</span>
                            </h1>
                        </motion.div>
                    </div>
                </div>

                {/* Bottom Section */}
                <div className="space-y-8">
                    {/* Features Carousel or Highlights */}
                    <div className="hidden md:flex justify-center gap-4">
                        {[
                            { icon: Briefcase, text: "Ribuan Loker" },
                            { icon: Search, text: "Cari Mudah" },
                            { icon: Star, text: "Terpercaya" }
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + (idx * 0.1) }}
                                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm w-24"
                            >
                                <item.icon className="w-6 h-6 text-emerald-300" />
                                <span className="text-[10px] font-medium text-emerald-100/80">{item.text}</span>
                            </motion.div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.8 }}
                        >
                            <h3 className="text-2xl font-bold text-white mb-2 leading-snug">
                                Temukan Karir <br />
                                <span className="text-emerald-200">Impianmu Sekarang</span>
                            </h3>
                            <p className="text-emerald-100/70 text-sm leading-relaxed mb-6">
                                Platform lowongan kerja terupdate dan terpercaya di area Jombang dan sekitarnya.
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1 }}
                            className="flex flex-col gap-3"
                        >
                            {/* Slide/Swipe Button Style */}
                            <Button
                                onClick={onStart}
                                className="w-full h-16 bg-white text-emerald-950 hover:bg-emerald-50 rounded-[1.25rem] text-lg font-bold shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-all group relative overflow-hidden"
                            >
                                <span className="relative z-10 flex items-center gap-3">
                                    Mulai Sekarang
                                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                                {/* Shimmer Effect */}
                                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0" />
                            </Button>

                            <div className="flex justify-center pt-2">
                                <Link href="#" className="text-sm font-medium text-emerald-200/80 hover:text-white transition-colors">
                                    Belum punya akun? <span className="underline decoration-emerald-400/50 underline-offset-4 text-emerald-100">Daftar disini</span>
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function LoginView({ onBack }: { onBack: () => void }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/admin";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Mohon isi email dan password");
            return;
        }

        setIsLoading(true);
        const supabase = createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            toast.error(`Login gagal: ${error.message}`);
            setIsLoading(false);
            return;
        }

        setIsSuccess(true);
        toast.success("Login berhasil!");

        setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
        }, 800);
    };

    return (
        <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            // Reset transforms on desktop to prevent fixed positioning issues
            className="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col md:relative md:inset-auto md:h-full md:w-full md:flex-row md:bg-white md:bg-none"
        >
            {/* Mobile Header Area - Hidden on Desktop */}
            <div className="md:hidden absolute top-0 left-0 right-0 h-32 bg-primary -z-10">
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent" />
            </div>

            <div className="md:hidden px-6 pt-6 pb-8 flex justify-between items-center text-white relative z-30">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <span className="font-semibold text-sm opacity-90 tracking-wide">Secure Login</span>
            </div>

            {/* Left Column (Desktop) / Bottom Sheet (Mobile) */}
            <div className="flex-1 bg-white rounded-t-[2.5rem] md:rounded-none -mt-4 pt-10 px-8 flex flex-col relative overflow-hidden md:justify-center md:px-16 md:pt-0 md:mt-0">
                {/* Decorative mobile top pill */}
                <div className="md:hidden absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-100 rounded-full" />

                <div className="mb-8 md:mb-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:hidden"
                    >
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back!</h2>
                        <p className="text-slate-500 text-sm">Masuk untuk melanjutkan aktivitasmu.</p>
                    </motion.div>

                    {/* Desktop Header */}
                    <div className="hidden md:block text-center space-y-3 mb-8">
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Welcome back!</h2>
                        <p className="text-slate-500 text-base max-w-sm mx-auto">Simplify your workflow and boost your productivity with InfoLoker Jombang.</p>
                    </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-6 flex-1 md:flex-none md:max-w-sm md:mx-auto md:w-full">
                    <div className="space-y-5">
                        <div className="space-y-2 group">
                            <Label className="uppercase text-[10px] font-bold text-slate-400 ml-1 tracking-wider text-primary group-focus-within:text-primary md:hidden">Email Address</Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none md:hidden">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                </div>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Username or Email"
                                    className="h-14 rounded-2xl md:rounded-full bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-800 focus:ring-0 transition-all pl-12 md:pl-6 shadow-sm font-medium text-base placeholder:text-slate-400"
                                    disabled={isLoading || isSuccess}
                                />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <Label className="uppercase text-[10px] font-bold text-slate-400 ml-1 tracking-wider text-primary group-focus-within:text-primary md:hidden">Password</Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none md:hidden">
                                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                </div>
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    className="h-14 rounded-2xl md:rounded-full bg-slate-50 border-slate-200 focus:bg-white focus:border-slate-800 focus:ring-0 transition-all pl-12 md:pl-6 pr-12 shadow-sm font-medium text-base placeholder:text-slate-400"
                                    disabled={isLoading || isSuccess}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 p-1 transition-colors">
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Link href="/forgot-password" className="text-sm font-bold text-slate-800 hover:text-primary transition-colors">
                            Forgot Password?
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        disabled={isLoading || isSuccess}
                        className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl md:rounded-full text-lg font-bold shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all mt-4"
                    >
                        {isSuccess ? (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Berhasil!</span>
                            </div>
                        ) : isLoading ? (
                            <FormLoader />
                        ) : (
                            <span className="flex items-center gap-2 justify-center">
                                Login
                                <ChevronRight className="w-5 h-5 opacity-50 md:hidden" />
                            </span>
                        )}
                    </Button>

                    <div className="text-center mt-8">
                        <span className="text-slate-500 text-sm">Not a member? </span>
                        <Link href="#" className="text-emerald-600 font-bold hover:underline">Register now</Link>
                    </div>
                </form>

                <div className="py-8 text-center md:hidden">
                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-widest opacity-60">
                        <div className="w-8 h-[1px] bg-slate-300" />
                        Secure Platform
                        <div className="w-8 h-[1px] bg-slate-300" />
                    </div>
                </div>
            </div>

            {/* Right Column (Desktop Only) */}
            <IllustrationPanel />

        </motion.div>
    );
}

// --- Main Page Component ---

export default function MobileFirstLoginPage() {
    const [step, setStep] = useState<'welcome' | 'login'>('welcome');
    const [isDesktop, setIsDesktop] = useState(false);

    // Effect to handle desktop default view
    useEffect(() => {
        const checkDesktop = () => {
            if (window.innerWidth >= 768) {
                setIsDesktop(true);
                setStep('login'); // Force login view on desktop
            } else {
                setIsDesktop(false);
            }
        };

        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    return (
        <div className="h-[100dvh] w-full bg-slate-950 relative font-sans overflow-hidden md:bg-white text-slate-900">
            {/* PWA Install Prompt - Only on Login Page */}
            <InstallPrompt />

            {/* Global Background Layer (Mobile Only) */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 to-slate-950 -z-20 md:hidden" />

            {/* Main Container */}
            <div className={`relative h-full w-full mx-auto shadow-2xl overflow-hidden 
                md:max-w-none md:rounded-none md:my-0 md:h-screen md:border-0 md:shadow-none bg-white
                ${step === 'welcome' && !isDesktop ? 'max-w-md rounded-[3rem] my-8 h-[calc(100vh-4rem)] border-8 border-slate-900' : ''}
            `}>
                <AnimatePresence mode="wait">
                    {/* Only show Welcome View if NOT desktop and step is welcome */}
                    {step === 'welcome' && !isDesktop && (
                        <WelcomeView key="welcome" onStart={() => setStep('login')} />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {/* Show Login View if step is login OR if it is Desktop (always show on desktop) */}
                    {(step === 'login' || isDesktop) && (
                        <LoginView key="login" onBack={() => {
                            if (!isDesktop) setStep('welcome');
                        }} />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
