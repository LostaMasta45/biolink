"use client";

import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export type Platform =
    | "android-app"
    | "ios-app"
    | "mobile-web"
    | "desktop-web";

export type PlatformInfo = {
    platform: Platform;
    isNativeApp: boolean;
    isAndroid: boolean;
    isIOS: boolean;
    isMobile: boolean;
    isDesktop: boolean;
    isWeb: boolean;
};

/**
 * Hook untuk mendeteksi platform yang sedang digunakan
 * - android-app: APK Android (Capacitor)
 * - ios-app: iOS App (Capacitor)
 * - mobile-web: Browser di HP
 * - desktop-web: Browser di Desktop
 */
export function usePlatform(): PlatformInfo {
    const [platformInfo, setPlatformInfo] = useState<PlatformInfo>(() => {
        // Default SSR-safe values
        return {
            platform: "desktop-web",
            isNativeApp: false,
            isAndroid: false,
            isIOS: false,
            isMobile: false,
            isDesktop: true,
            isWeb: true,
        };
    });

    useEffect(() => {
        const detectPlatform = (): Platform => {
            const capacitorPlatform = Capacitor.getPlatform();
            const isNative = Capacitor.isNativePlatform();

            // Native app (APK/IPA)
            if (isNative) {
                return capacitorPlatform === "ios" ? "ios-app" : "android-app";
            }

            // Web browser - check if mobile or desktop
            const isMobileDevice =
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                    navigator.userAgent
                ) || window.innerWidth < 768;

            return isMobileDevice ? "mobile-web" : "desktop-web";
        };

        const platform = detectPlatform();
        const isNative = Capacitor.isNativePlatform();

        setPlatformInfo({
            platform,
            isNativeApp: isNative,
            isAndroid: platform === "android-app",
            isIOS: platform === "ios-app",
            isMobile: platform === "android-app" || platform === "ios-app" || platform === "mobile-web",
            isDesktop: platform === "desktop-web",
            isWeb: !isNative,
        });

        // Listen for resize to update mobile/desktop detection
        const handleResize = () => {
            if (!isNative) {
                const isMobileDevice = window.innerWidth < 768;
                const newPlatform = isMobileDevice ? "mobile-web" : "desktop-web";

                setPlatformInfo(prev => ({
                    ...prev,
                    platform: newPlatform,
                    isMobile: isMobileDevice,
                    isDesktop: !isMobileDevice,
                }));
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return platformInfo;
}

/**
 * Komponen helper untuk render kondisional berdasarkan platform
 */
export function PlatformView({
    android,
    ios,
    mobileWeb,
    desktopWeb,
    native,
    web,
    mobile,
    desktop,
    children,
}: {
    android?: React.ReactNode;
    ios?: React.ReactNode;
    mobileWeb?: React.ReactNode;
    desktopWeb?: React.ReactNode;
    native?: React.ReactNode;
    web?: React.ReactNode;
    mobile?: React.ReactNode;
    desktop?: React.ReactNode;
    children?: React.ReactNode;
}) {
    const { platform, isNativeApp, isMobile, isDesktop } = usePlatform();

    // Specific platform views
    if (platform === "android-app" && android) return <>{ android } </>;
    if (platform === "ios-app" && ios) return <>{ ios } </>;
    if (platform === "mobile-web" && mobileWeb) return <>{ mobileWeb } </>;
    if (platform === "desktop-web" && desktopWeb) return <>{ desktopWeb } </>;

    // Category views
    if (isNativeApp && native) return <>{ native } </>;
    if (!isNativeApp && web) return <>{ web } </>;
    if (isMobile && mobile) return <>{ mobile } </>;
    if (isDesktop && desktop) return <>{ desktop } </>;

    // Default fallback
    return <>{ children } </>;
}
