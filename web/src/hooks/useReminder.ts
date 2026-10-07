import { useEffect, useState } from 'react';
import { api } from '../api';

export type ReminderSettings = {
    enabled: boolean;
    time: string; // HH:MM, 24h
};

export type EnableResult = 'ok' | 'blocked' | 'failed';

const SERVICE_WORKER_URL = '/sw.js';

export function pushSupported() {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

// The server's public key comes as base64url text; the browser wants bytes.
function keyToBytes(base64Url: string) {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
    }
    return bytes;
}

// This device's push subscription, if it has one. Never asks for permission
// and never registers anything, so it is safe to call on page load.
async function currentSubscription() {
    if (!pushSupported()) return null;
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    return (await registration?.pushManager.getSubscription()) ?? null;
}

async function subscribeThisDevice() {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await navigator.serviceWorker.ready;

    const { publicKey } = await api.getPushPublicKey();
    const options = { userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) };

    try {
        return await registration.pushManager.subscribe(options);
    } catch {
        // An old subscription made with a different server key blocks a new one: replace it.
        const old = await registration.pushManager.getSubscription();
        await old?.unsubscribe();
        return registration.pushManager.subscribe(options);
    }
}

// Stops push on this device and tells the server to forget it.
// Call it before logging out, while the login token still works.
export async function forgetThisDevice() {
    try {
        const subscription = await currentSubscription();
        if (!subscription) return;
        await api.deletePushSubscription(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
    } catch {
        // Best effort: the server also drops devices that stop answering.
    }
}

// The daily reminder. The server sends it as a push notification,
// so it arrives even when Day Planner is not open. Needs an account.
export function useReminder(loggedIn: boolean) {
    const [settings, setSettings] = useState<ReminderSettings>({ enabled: false, time: '09:00' });
    const [deviceSubscribed, setDeviceSubscribed] = useState(false);

    // Load the saved setting and check this device. No permission prompt here.
    useEffect(() => {
        if (!loggedIn) return;
        let cancelled = false;

        Promise.all([api.getReminder(), currentSubscription()])
            .then(([reminder, subscription]) => {
                if (cancelled) return;
                setSettings({ enabled: reminder.enabled, time: reminder.time });
                setDeviceSubscribed(subscription !== null);
            })
            .catch(() => {
                // Reminders stay shown as off; the tasks hook handles a lost login.
            });

        return () => {
            cancelled = true;
        };
    }, [loggedIn]);

    // On: the reminder is enabled and this device will receive it.
    const active = loggedIn && settings.enabled && deviceSubscribed;

    // Runs only when the user clicks "Turn on reminders": this is the one place
    // that asks for notification permission.
    async function enable(time: string): Promise<EnableResult> {
        if (!pushSupported()) return 'failed';

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return 'blocked';

            const subscription = await subscribeThisDevice();
            await api.savePushSubscription(subscription.toJSON());
            await api.saveReminder({
                enabled: true,
                time,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });

            setSettings({ enabled: true, time });
            setDeviceSubscribed(true);
            return 'ok';
        } catch {
            return 'failed';
        }
    }

    // Turns the reminder off for the account and removes this device.
    async function disable() {
        try {
            await api.saveReminder({
                enabled: false,
                time: settings.time,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            await forgetThisDevice();
            setSettings({ ...settings, enabled: false });
            setDeviceSubscribed(false);
            return true;
        } catch {
            return false;
        }
    }

    // Asks the server to push a test notification. Returns true when it was sent.
    async function sendTest() {
        try {
            const result = await api.sendTestPush();
            return result.sent > 0;
        } catch {
            return false;
        }
    }

    return { settings, active, enable, disable, sendTest };
}
