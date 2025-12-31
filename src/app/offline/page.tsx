'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

export default function OfflinePage() {
    useEffect(() => {
        // Check if back online
        const handleOnline = () => {
            window.location.href = '/';
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    const handleRetry = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = '/';
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-4">
            {/* Background decoration */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
                <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative w-full max-w-md"
            >
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.2 }}
                        className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20"
                    >
                        <WifiOff className="h-12 w-12 text-amber-400" />
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-2xl font-bold text-white"
                    >
                        Anda Sedang Offline
                    </motion.h1>

                    {/* Description */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-3 text-zinc-400"
                    >
                        Sepertinya koneksi internet Anda terputus. Periksa koneksi dan coba lagi.
                    </motion.p>

                    {/* Tips */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 rounded-xl bg-white/5 p-4 text-left"
                    >
                        <p className="text-sm font-medium text-white">Tips:</p>
                        <ul className="mt-2 space-y-1 text-sm text-zinc-400">
                            <li>• Periksa koneksi WiFi atau data seluler</li>
                            <li>• Coba matikan dan nyalakan mode pesawat</li>
                            <li>• Pindah ke lokasi dengan sinyal lebih baik</li>
                        </ul>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="mt-6 flex gap-3"
                    >
                        <button
                            onClick={handleGoHome}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 font-medium text-white transition-colors hover:bg-white/10"
                        >
                            <Home className="h-4 w-4" />
                            Beranda
                        </button>
                        <button
                            onClick={handleRetry}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Coba Lagi
                        </button>
                    </motion.div>

                    {/* Auto-reconnect indicator */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="mt-6 flex items-center justify-center gap-2 text-xs text-zinc-500"
                    >
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                        Akan otomatis refresh saat online
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
}
