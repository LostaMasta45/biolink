'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

export function usePWA() {
    const [isInstalled, setIsInstalled] = useState(false);
    const [isInstallable, setIsInstallable] = useState(false);
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        setIsInstalled(isStandalone);

        // Check if iOS
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
        setIsIOS(ios);

        // Listen for beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for app installed event
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setIsInstallable(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js', { scope: '/' })
                .then((reg) => {
                    console.log('[PWA] Service worker registered');
                    setRegistration(reg);

                    // Check for updates immediately
                    reg.update();

                    // Check for updates periodically (every 5 minutes)
                    setInterval(() => {
                        reg.update();
                    }, 5 * 60 * 1000);

                    // Listen for new service worker
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[PWA] New version available');
                                    setIsUpdateAvailable(true);
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.error('[PWA] Service worker registration failed:', error);
                });

            // Listen for controller change (after update)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[PWA] Controller changed, reloading...');
                window.location.reload();
            });
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const installApp = async () => {
        if (!deferredPrompt) return false;

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                setIsInstalled(true);
                setIsInstallable(false);
            }

            setDeferredPrompt(null);
            return outcome === 'accepted';
        } catch (error) {
            console.error('[PWA] Install failed:', error);
            return false;
        }
    };

    const updateApp = () => {
        if (registration?.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    const checkForUpdate = async () => {
        if (registration) {
            await registration.update();
        }
    };

    return {
        isInstalled,
        isInstallable,
        isUpdateAvailable,
        isIOS,
        installApp,
        updateApp,
        checkForUpdate,
        registration,
    };
}
