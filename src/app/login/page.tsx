"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

function PageLoader() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-white/80 backdrop-blur-xl">
            <div className="relative">
                <motion.div
                    className="w-20 h-20 rounded-2xl relative border-2 border-primary/20"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                >
                    <div className="absolute inset-2 rounded-xl bg-gradient-to-tr from-primary/20 to-secondary/20 blur-xl" />
                </motion.div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary animate-pulse shadow-lg shadow-primary/30" />
                </div>
            </div>
        </div>
    );
}


function LoginForm() {
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
            toast.error("Login gagal: " + error.message);
            setIsLoading(false);
            return;
        }

        setIsSuccess(true);
        toast.success("Login berhasil!");

        // Slight delay for animation before redirect
        setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
        }, 800);
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                damping: 25,
                stiffness: 100,
                staggerChildren: 0.1,
                delayChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 300, damping: 24 }
        },
    };

    return (
        <motion.div
            className="w-full max-w-[400px] relative z-20"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Mobile Card Enhancement */}
            <div className="md:hidden absolute -inset-4 bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-black/5 -z-10" />

            <div className="p-6 md:p-0">
                <motion.div variants={itemVariants} className="space-y-3 mb-8 text-center md:text-left">
                    {/* Mobile Logo */}
                    <div className="flex justify-center md:justify-start md:hidden mb-8">
                        <div className="relative w-24 h-24 rounded-3xl overflow-hidden shadow-2xl shadow-primary/20 ring-4 ring-white">
                            <Image
                                src="/icon.png"
                                alt="Logo"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 relative inline-block">
                        Selamat Datang
                        <span className="absolute -right-6 top-1 md:hidden">
                            <Sparkles className="w-5 h-5 text-amber-400 fill-amber-300 animate-pulse" />
                        </span>
                    </h1>
                    <p className="text-slate-600 md:text-slate-500 font-medium md:font-normal text-base leading-relaxed">
                        Masuk kembali untuk mengelola Dashboard anda
                    </p>
                </motion.div>

                <motion.form variants={itemVariants} onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-5">
                        <div className="space-y-2 group">
                            <Label htmlFor="email" className="text-slate-800 font-semibold group-focus-within:text-primary transition-colors text-[0.95rem]">
                                Email Address
                            </Label>
                            <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.01]">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors duration-300" />
                                </div>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-12 h-14 bg-white md:bg-slate-50/50 border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-base text-slate-900 placeholder:text-slate-300 transition-all duration-300 shadow-sm group-hover:border-slate-300"
                                    disabled={isLoading || isSuccess}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group">
                            <Label htmlFor="password" className="text-slate-800 font-semibold group-focus-within:text-primary transition-colors text-[0.95rem]">
                                Password
                            </Label>
                            <div className="relative transition-all duration-300 transform group-focus-within:scale-[1.01]">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors duration-300" />
                                </div>
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-12 pr-12 h-14 bg-white md:bg-slate-50/50 border-2 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-base text-slate-900 placeholder:text-slate-300 transition-all duration-300 shadow-sm group-hover:border-slate-300"
                                    disabled={isLoading || isSuccess}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer z-10"
                                    tabIndex={-1}
                                    disabled={isLoading || isSuccess}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <motion.div
                            whileHover={{ scale: 1.02, translateY: -2 }}
                            whileTap={{ scale: 0.98, translateY: 0 }}
                            className="relative z-10"
                        >
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                            <Button
                                disabled={isLoading || isSuccess}
                                className="relative w-full h-14 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-xl shadow-primary/20 rounded-2xl text-lg font-bold tracking-wide transition-all duration-300 border border-white/10"
                            >
                                {isSuccess ? (
                                    <motion.div
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="flex items-center gap-2"
                                    >
                                        <div className="bg-white text-primary rounded-full p-1">
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                        <span>Berhasil Masuk!</span>
                                    </motion.div>
                                ) : isLoading ? (
                                    <FormLoader />
                                ) : (
                                    <span className="flex items-center gap-2">
                                        Sign In
                                        <ArrowRight className="h-5 w-5 opacity-80" />
                                    </span>
                                )}
                            </Button>
                        </motion.div>
                    </div>
                </motion.form>

                <motion.p variants={itemVariants} className="mt-10 text-center text-sm font-medium text-slate-400">
                    © {new Date().getFullYear()} InfoLokerJombang. <br className="md:hidden" /> Protected Platform.
                </motion.p>
            </div>
        </motion.div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen grid md:grid-cols-2 bg-slate-50 overflow-hidden font-sans">
            {/* Mobile Background - More Subtle */}
            <div className="absolute inset-0 md:hidden z-0 bg-slate-100">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-60" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-white to-transparent" />
            </div>

            {/* Left Side - Illustration (Desktop) */}
            <div className="hidden md:flex relative flex-col justify-between p-12 lg:p-16 bg-slate-900 text-white overflow-hidden shadow-2xl z-20">
                {/* Background Image / Pattern */}
                <div className="absolute inset-0 z-0 select-none pointer-events-none">
                    <Image
                        src="/login-illustration-v3.png"
                        alt="Login Illustration"
                        fill
                        className="object-cover opacity-80 mix-blend-overlay"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/90 via-slate-900/90 to-black/90" />
                    <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />

                    {/* Animated Glow Orbs */}
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/30 rounded-full blur-[128px] mix-blend-screen opacity-50 animate-pulse delay-700" />
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-secondary/30 rounded-full blur-[100px] mix-blend-screen opacity-50 animate-pulse" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex items-center space-x-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="relative h-14 w-14 rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/20 bg-white/5 backdrop-blur-sm"
                    >
                        <Image
                            src="/icon.png"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </motion.div>
                    <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="font-bold text-2xl tracking-tight text-white drop-shadow-lg"
                    >
                        InfoLokerJombang
                    </motion.span>
                </div>

                <div className="relative z-10 max-w-xl space-y-8 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8, type: "spring" as const }}
                    >
                        <h2 className="text-5xl lg:text-6xl font-extrabold leading-[1.1] text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 mb-6 drop-shadow-sm">
                            Platform Kelola <br />
                            <span className="text-emerald-400 inline-block filter drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                                Lowongan Kerja
                            </span>
                        </h2>
                        <p className="text-slate-300 text-lg lg:text-xl leading-relaxed font-light max-w-lg border-l-2 border-primary/50 pl-6">
                            Akses dashboard eksklusif untuk memantau aktivitas, mengelola konten lowongan, dan analisis performa secara <span className="text-white font-medium">real-time</span>.
                        </p>
                    </motion.div>

                    {/* Stats or Trust Indicators could go here */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="flex items-center gap-6 pt-4"
                    >
                        <div className="flex -space-x-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-xs text-white box-content">
                                    <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                                </div>
                            ))}
                        </div>
                        <div className="text-sm text-slate-400 font-medium">
                            Bergabung bersama ribuan pencari kerja
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 text-xs text-slate-500 font-mono tracking-wider">
                    SECURE ADMIN PORTAL • V2.0.4
                </div>
            </div>

            {/* Right Side - Form Container */}
            <div className="relative z-10 flex flex-col justify-center items-center h-full w-full p-4 md:p-12 lg:p-20 bg-white md:bg-transparent">
                {/* Desktop Decorative Elements for Right Side */}
                <div className="hidden md:block absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-slate-100 rounded-full blur-[100px] opacity-60 translate-x-1/3 -translate-y-1/3" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-slate-50 rounded-full blur-[80px] opacity-80 -translate-x-1/4 translate-y-1/4" />
                </div>

                <Suspense fallback={<PageLoader />}>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    );
}
