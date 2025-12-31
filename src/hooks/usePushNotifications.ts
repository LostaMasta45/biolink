'use client';

import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);

    useEffect(() => {
        // Check if push notifications are supported
        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);
            checkSubscription();
        }
    }, []);

    const checkSubscription = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const sub = await registration.pushManager.getSubscription();
            setSubscription(sub);
            setIsSubscribed(!!sub);
        } catch (error) {
            console.error('[Push] Error checking subscription:', error);
        }
    };

    const subscribe = async (): Promise<PushSubscription | null> => {
        if (!isSupported) {
            console.warn('[Push] Push notifications not supported');
            return null;
        }

        try {
            // Request notification permission
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                console.warn('[Push] Notification permission denied');
                return null;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Convert VAPID key to Uint8Array
            const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            // Subscribe to push
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });

            console.log('[Push] Subscribed:', sub);
            setSubscription(sub);
            setIsSubscribed(true);

            return sub;
        } catch (error) {
            console.error('[Push] Subscription failed:', error);
            return null;
        }
    };

    const unsubscribe = async (): Promise<boolean> => {
        if (!subscription) return false;

        try {
            await subscription.unsubscribe();
            setSubscription(null);
            setIsSubscribed(false);
            console.log('[Push] Unsubscribed');
            return true;
        } catch (error) {
            console.error('[Push] Unsubscribe failed:', error);
            return false;
        }
    };

    return {
        isSupported,
        isSubscribed,
        permission,
        subscription,
        subscribe,
        unsubscribe,
        checkSubscription,
    };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray as Uint8Array<ArrayBuffer>;
}
