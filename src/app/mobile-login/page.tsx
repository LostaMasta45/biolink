"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

export default function MobileLoginPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        // Simulate login delay
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <div className="min-h-screen bg-primary relative flex flex-col font-sans overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
            <div className="absolute top-20 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 blur-2xl" />

            {/* Header */}
            <header className="relative z-10 flex items-center justify-between p-6 px-8 text-primary-foreground">
                <Link href="/" className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <Link href="/register" className="text-sm font-semibold hover:underline underline-offset-4 opacity-90 hover:opacity-100">
                    Register
                </Link>
            </header>

            {/* Hero Section */}
            <div className="relative z-10 px-8 pt-4 pb-12 flex flex-col justify-end min-h-[160px]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl font-bold text-primary-foreground mb-3">Sign In</h1>
                    <p className="text-primary-foreground/80 text-sm leading-relaxed max-w-[80%]">
                        Masuk angkat karirmu bersama InfoLokerJombang. Kelola lowongan dengan mudah.
                    </p>
                </motion.div>
            </div>

            {/* Main Content Card - Bottom Sheet Style */}
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="flex-1 bg-white rounded-t-[2.5rem] relative z-20 overflow-hidden"
            >
                <div className="h-full overflow-y-auto px-8 py-10 pb-8">
                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">
                                    Username / Email
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Username"
                                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:border-primary/20 text-slate-900 placeholder:text-slate-400 pl-5 shadow-sm transition-all text-base"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">
                                    Password
                                </label>
                                <Input
                                    type="password"
                                    placeholder="Password"
                                    className="h-14 rounded-2xl bg-slate-50 border-slate-100 focus:bg-white focus:border-primary/20 text-slate-900 placeholder:text-slate-400 pl-5 shadow-sm transition-all text-base"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-1">
                            <Link
                                href="/forgot-password"
                                className="text-sm font-bold text-slate-900 hover:text-primary transition-colors"
                            >
                                Forgot Password?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-14 bg-slate-950 hover:bg-slate-900 text-white rounded-2xl text-lg font-bold shadow-lg shadow-slate-900/20 active:scale-[0.98] transition-all"
                        >
                            {isLoading ? "Signing In..." : "Sign In"}
                        </Button>
                    </form>

                    {/* Social Login */}
                    <div className="mt-10 space-y-4">
                        <Button
                            variant="outline"
                            className="w-full h-14 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-sm justify-between px-6 group"
                        >
                            <div className="w-6 h-6 relative shrink-0">
                                {/* Google G Logo */}
                                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full">
                                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                </svg>
                            </div>
                            <span className="flex-1 text-center">Continue with Google</span>
                            <div className="w-6" /> {/* Spacer for centering */}
                        </Button>

                        <Button
                            variant="outline"
                            className="w-full h-14 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-sm justify-between px-6"
                        >
                            <Facebook className="w-6 h-6 text-[#1877F2] fill-[#1877F2]" />
                            <span className="flex-1 text-center">Continue with Facebook</span>
                            <div className="w-6" />
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
