"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/admin";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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

        toast.success("Login berhasil!");
        router.push(redirectTo);
        router.refresh();
    };

    return (
        <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <Lock className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                    Admin Login
                </CardTitle>
                <CardDescription>
                    Masuk ke dashboard InfoLokerJombang
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@infolokerjombang.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-9"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-9 pr-9"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>
                    <Button
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                    >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                Masuk Dashboard
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="justify-center">
                <p className="text-xs text-muted-foreground">
                    © 2024 InfoLokerJombang
                </p>
            </CardFooter>
        </Card>
    );
}

function LoginFormFallback() {
    return (
        <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <CardTitle>Memuat...</CardTitle>
            </CardHeader>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
            {/* Background blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/20 blur-[100px]" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md"
            >
                <Suspense fallback={<LoginFormFallback />}>
                    <LoginForm />
                </Suspense>
            </motion.div>
        </div>
    );
}
