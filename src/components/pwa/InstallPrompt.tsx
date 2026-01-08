'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share, Plus } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export function InstallPrompt() {
    const { isInstallable, isInstalled, isIOS, installApp } = usePWA();
    const [dismissed, setDismissed] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    // Check localStorage for dismissed state
    useEffect(() => {
        const dismissedUntil = localStorage.getItem('pwa-install-dismissed');
        if (dismissedUntil) {
            const until = parseInt(dismissedUntil, 10);
            if (Date.now() < until) {
                setDismissed(true);
            } else {
                localStorage.removeItem('pwa-install-dismissed');
            }
        }
    }, []);

    const handleDismiss = () => {
        // Dismiss for 7 days
        const dismissUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('pwa-install-dismissed', dismissUntil.toString());
        setDismissed(true);
    };

    const handleInstall = async () => {
        if (isIOS) {
            setShowIOSGuide(true);
        } else {
            const success = await installApp();
            if (success) {
                setDismissed(true);
            }
        }
    };

    // Don't show if already installed or dismissed
    if (isInstalled || dismissed) return null;

    // Show for installable browsers or iOS
    if (!isInstallable && !isIOS) return null;

    return (
        <AnimatePresence>
            {/* iOS Guide Modal */}
            {showIOSGuide && (
                <motion.div
                    key="ios-guide"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowIOSGuide(false)}
                >
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg rounded-t-3xl bg-white p-6 dark:bg-zinc-900"
                    >
                        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />

                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                            Install ILJ Hub di iPhone/iPad
                        </h3>

                        <div className="mt-6 space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30">
                                    <Share className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-white">
                                        Langkah 1
                                    </p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Tap tombol <strong>Share</strong> di Safari (ikon kotak dengan panah ke atas)
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30">
                                    <Plus className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-white">
                                        Langkah 2
                                    </p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Scroll ke bawah dan tap <strong>"Add to Home Screen"</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30">
                                    <Download className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-zinc-900 dark:text-white">
                                        Langkah 3
                                    </p>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                        Tap <strong>"Add"</strong> untuk menyelesaikan instalasi
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowIOSGuide(false)}
                            className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                            Mengerti
                        </button>
                    </motion.div>
                </motion.div>
            )}

            {/* Install Banner */}
            <motion.div
                key="install-banner"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed bottom-20 left-4 right-4 z-[9998] md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
            >
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600/90 to-teal-700/90 p-4 shadow-2xl backdrop-blur-xl">
                    {/* Glow effect */}
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-emerald-400/30 blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-teal-400/30 blur-3xl" />

                    {/* Close button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="relative flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                            <Download className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 pr-6">
                            <h3 className="font-semibold text-white">Install Aplikasi 📱</h3>
                            <p className="mt-1 text-sm text-white/80">
                                Install ILJ Hub untuk akses cepat dan pengalaman lebih baik!
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-4">
                        <button
                            onClick={handleInstall}
                            className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-600 transition-all hover:bg-white/90 hover:shadow-lg"
                        >
                            {isIOS ? 'Lihat Panduan' : 'Install Sekarang'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
