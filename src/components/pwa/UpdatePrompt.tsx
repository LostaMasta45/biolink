'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

export function UpdatePrompt() {
    const { isUpdateAvailable, updateApp } = usePWA();
    const [dismissed, setDismissed] = useState(false);

    // Reset dismissed state when new update is available
    useEffect(() => {
        if (isUpdateAvailable) {
            setDismissed(false);
        }
    }, [isUpdateAvailable]);

    if (!isUpdateAvailable || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:right-4 md:max-w-sm"
            >
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/90 to-indigo-700/90 p-4 shadow-2xl backdrop-blur-xl">
                    {/* Glow effect */}
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-blue-400/30 blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 h-24 w-24 rounded-full bg-indigo-400/30 blur-3xl" />

                    {/* Close button */}
                    <button
                        onClick={() => setDismissed(true)}
                        className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="relative flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
                            <RefreshCw className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 pr-6">
                            <h3 className="font-semibold text-white">Update Tersedia! 🎉</h3>
                            <p className="mt-1 text-sm text-white/80">
                                Versi baru sudah siap. Klik untuk memperbarui aplikasi.
                            </p>
                        </div>
                    </div>

                    <div className="relative mt-4 flex gap-2">
                        <button
                            onClick={() => setDismissed(true)}
                            className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                        >
                            Nanti
                        </button>
                        <button
                            onClick={updateApp}
                            className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition-all hover:bg-white/90 hover:shadow-lg"
                        >
                            Update Sekarang
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
