"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
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
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }}
            />
            <motion.div
                className="h-2 w-2 bg-white rounded-full"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
            />
            <motion.div
                className="h-2 w-2 bg-white rounded-full"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            />
        </div>
    );
}

function PageLoader() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <motion.div
                className="w-20 h-20 rounded-2xl relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
                <div className="absolute inset-0 rounded-2xl border-t-4 border-l-4 border-primary opacity-20" />
                <div className="absolute inset-2 rounded-xl border-r-4 border-b-4 border-secondary opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary animate-pulse" />
                </div>
            </motion.div>
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
        hidden: { opacity: 0, y: "100%" },
        visible: {
            opacity: 1,
            y: "0%",
            transition: {
                type: "spring" as const,
                damping: 25,
                stiffness: 100,
                staggerChildren: 0.1,
                delayChildren: 0.2,
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
            className="w-full max-w-sm md:max-w-md bg-white md:bg-transparent rounded-t-[2rem] md:rounded-none p-8 md:p-0 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.1)] md:shadow-none"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            <motion.div variants={itemVariants} className="space-y-4 mb-8 text-center md:text-left">
                {/* Mobile Logo */}
                <div className="flex justify-center md:hidden mb-6">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-primary/20">
                        <Image
                            src="/icon.png"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                    Selamat Datang
                </h1>
                <p className="text-slate-500">
                    Masuk untuk mengelola Dashboard
                </p>
            </motion.div>

            <motion.form variants={itemVariants} onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-5">
                    <div className="space-y-2 group">
                        <Label htmlFor="email" className="text-slate-600 font-medium group-focus-within:text-primary transition-colors">Email Address</Label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-12 h-12 bg-slate-50 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all duration-300"
                                disabled={isLoading || isSuccess}
                            />
                        </div>
                    </div>
                    <div className="space-y-2 group">
                        <Label htmlFor="password" className="text-slate-600 font-medium group-focus-within:text-primary transition-colors">Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-12 pr-12 h-12 bg-slate-50 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all duration-300"
                                disabled={isLoading || isSuccess}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-900 transition-colors"
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

                <div className="pt-2">
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            disabled={isLoading || isSuccess}
                            className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg shadow-primary/25 rounded-xl text-lg font-medium transition-all duration-300"
                        >
                            {isSuccess ? (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="flex items-center"
                                >
                                    <CheckCircle2 className="mr-2 h-6 w-6" />
                                    Berhasil!
                                </motion.div>
                            ) : isLoading ? (
                                <FormLoader />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    </motion.div>
                </div>
            </motion.form>

            <motion.p variants={itemVariants} className="mt-8 text-center text-xs text-slate-400">
                © {new Date().getFullYear()} InfoLokerJombang. Protected.
            </motion.p>
        </motion.div>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen grid md:grid-cols-2 bg-slate-50 md:bg-white overflow-hidden">
            {/* Mobile Background (Shown behind sheet) */}
            <div className="absolute inset-0 md:hidden z-0">
                <Image
                    src="/login-illustration-v4.png"
                    alt="Background"
                    fill
                    className="object-cover opacity-100"
                    priority
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
            </div>

            {/* Left Side - Illustration (Desktop) */}
            <div className="hidden md:flex relative flex-col justify-between p-12 bg-slate-50 text-slate-900 overflow-hidden">
                {/* Background Image / Pattern */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/login-illustration-v3.png"
                        alt="Login Illustration"
                        fill
                        className="object-cover"
                        priority
                    />
                    {/* Glass Overlay */}
                    <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]" />
                </div>

                {/* Content Overlay */}
                <div className="relative z-10 flex items-center space-x-4">
                    <div className="relative h-12 w-12 rounded-xl overflow-hidden shadow-lg border-2 border-white/50">
                        <Image
                            src="/icon.png"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white drop-shadow-md">InfoLokerJombang</span>
                </div>

                <div className="relative z-10 max-w-lg space-y-6 mb-12">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.8 }}
                        className="p-8 rounded-3xl bg-black/30 backdrop-blur-md border border-white/10 shadow-2xl"
                    >
                        <h2 className="text-4xl font-bold leading-tight text-white mb-4 drop-shadow-2xl">
                            Platform Kelola<br />
                            <span className="text-emerald-400 drop-shadow-md">
                                Lowongan Kerja
                            </span>
                        </h2>
                        <p className="text-slate-200 text-lg leading-relaxed font-medium drop-shadow-md">
                            Akses dashboard admin untuk memantau aktivitas, mengelola konten, dan melihat analitik terkini secara real-time.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* Right Side - Form Container */}
            <div className="relative z-10 flex flex-col justify-end md:justify-center items-center h-full w-full md:p-8">
                <Suspense fallback={<PageLoader />}>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    );
}
