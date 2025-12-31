'use client';

import { useEffect, useState } from 'react';

interface UsePlatformReturn {
    isStandalone: boolean;
    isPWA: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    safeAreaInsets: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}

export function usePlatform(): UsePlatformReturn {
    const [platform, setPlatform] = useState<UsePlatformReturn>({
        isStandalone: false,
        isPWA: false,
        isIOS: false,
        isAndroid: false,
        isMobile: false,
        safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    useEffect(() => {
        const checkPlatform = () => {
            const ua = navigator.userAgent.toLowerCase();

            // Check if standalone (installed PWA)
            const isStandalone =
                window.matchMedia('(display-mode: standalone)').matches ||
                (window.navigator as unknown as { standalone?: boolean }).standalone === true;

            // Check platforms
            const isIOS = /iphone|ipad|ipod/.test(ua);
            const isAndroid = /android/.test(ua);
            const isMobile = isIOS || isAndroid || /mobile/.test(ua);

            // Get safe area insets
            const computedStyle = getComputedStyle(document.documentElement);
            const safeAreaInsets = {
                top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0', 10) || 0,
                right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0', 10) || 0,
                bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0', 10) || 0,
                left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0', 10) || 0,
            };

            setPlatform({
                isStandalone,
                isPWA: isStandalone,
                isIOS,
                isAndroid,
                isMobile,
                safeAreaInsets,
            });
        };

        checkPlatform();

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = () => checkPlatform();
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    return platform;
}
