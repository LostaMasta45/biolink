'use client';

import { usePlatform } from '@/hooks/usePlatform';

interface PWAHeaderProps {
    children?: React.ReactNode;
    className?: string;
    title?: string;
    showBackButton?: boolean;
    onBack?: () => void;
    rightAction?: React.ReactNode;
}

export function PWAHeader({
    children,
    className = '',
    title,
    showBackButton = false,
    onBack,
    rightAction,
}: PWAHeaderProps) {
    const { isPWA } = usePlatform();

    // If not PWA mode, render children or nothing
    if (!isPWA) {
        return children ? <>{children}</> : null;
    }

    return (
        <>
            {/* Status bar background for notch area */}
            <div className="pwa-status-bar" />

            {/* Native-style header */}
            <header
                className={`fixed top-0 left-0 right-0 z-50 ${className}`}
                style={{
                    paddingTop: 'calc(var(--safe-area-inset-top, 0px) + 0.5rem)',
                }}
            >
                <div className="flex h-12 items-center justify-between bg-background/80 px-4 backdrop-blur-xl border-b border-border/50">
                    {/* Left side - Back button */}
                    <div className="flex items-center gap-2 min-w-[60px]">
                        {showBackButton && (
                            <button
                                onClick={onBack || (() => window.history.back())}
                                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="m15 18-6-6 6-6" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {/* Center - Title */}
                    <div className="flex-1 text-center">
                        {title && (
                            <h1 className="text-base font-semibold truncate">{title}</h1>
                        )}
                    </div>

                    {/* Right side - Action */}
                    <div className="flex items-center gap-2 min-w-[60px] justify-end">
                        {rightAction}
                    </div>
                </div>
            </header>

            {/* Spacer to push content below header */}
            <div
                style={{
                    height: 'calc(var(--safe-area-inset-top, 0px) + 3.5rem)'
                }}
            />
        </>
    );
}

interface PWAContainerProps {
    children: React.ReactNode;
    className?: string;
}

export function PWAContainer({ children, className = '' }: PWAContainerProps) {
    const { isPWA } = usePlatform();

    return (
        <div
            className={`min-h-screen ${className}`}
            style={{
                paddingBottom: isPWA ? 'var(--safe-area-inset-bottom, 0px)' : undefined,
            }}
        >
            {children}
        </div>
    );
}

interface PWABottomNavProps {
    children: React.ReactNode;
    className?: string;
}

export function PWABottomNav({ children, className = '' }: PWABottomNavProps) {
    const { isPWA } = usePlatform();

    return (
        <nav
            className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 backdrop-blur-xl ${className}`}
            style={{
                paddingBottom: isPWA ? 'var(--safe-area-inset-bottom, 0px)' : undefined,
            }}
        >
            {children}
        </nav>
    );
}
