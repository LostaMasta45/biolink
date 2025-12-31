'use client';

import { UpdatePrompt } from './UpdatePrompt';

export function PWAProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <UpdatePrompt />
        </>
    );
}

