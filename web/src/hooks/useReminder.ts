import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type Reminder } from '../api';
import { playChime } from '../lib/sound';

// Why setting up this device for notifications worked or did not.
export type DeviceResult =
    | 'ok'
    | 'blocked' // the user or the browser refused notification permission
    | 'no-answer' // the browser never answered the subscribe request
    | 'browser-refused' // the browser rejected the subscribe request
    | 'server'; // our API could not be reached or refused

// Adding a reminder can also fail for reasons of its own.
export type AddResult =
    | DeviceResult
    | 'past' // the chosen date and time have already passed
    | 'limit'; // too many reminders

// What happened to a test notification.
export type TestResult =
    | 'shown' // this browser received and displayed it
    | 'not-shown' // the push service accepted it, but this browser did not display it
    | 'no-device' // this browser is not subscribed
    | 'rejected' // the push service refused our server (wrong VAPID keys)
    | 'server'; // our API could not be reached or the push service did not answer

export type ReminderDraft = {
    text: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    repeatDaily: boolean;
};

const SERVICE_WORKER_URL = '/sw.js';
const BROWSER_TIMEOUT_MS = 20_000;
const TEST_WAIT_MS = 12_000;

export function pushSupported() {
    return (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    );
}

class NoAnswerError extends Error {}

// Some browsers never settle push requests (for example when push is switched off
// in their settings). Without this the dialog would wait forever, silently.
function orGiveUp<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new NoAnswerError()), BROWSER_TIMEOUT_MS),
        ),
    ]);
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

async function subscribeThisDevice(publicKey: string) {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    await orGiveUp(navigator.serviceWorker.ready);

    const options = { userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) };

    try {
        return await orGiveUp(registration.pushManager.subscribe(options));
    } catch (err) {
        if (err instanceof NoAnswerError) throw err;
        // An old subscription made with a different server key blocks a new one: replace it.
        const old = await registration.pushManager.getSubscription();
        await old?.unsubscribe();
        return orGiveUp(registration.pushManager.subscribe(options));
    }
}

// Notifications this browser is showing right now for Day Planner.
async function shownNotifications() {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    return (await registration?.getNotifications()) ?? [];
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

// The user's reminders. The server sends each one as a push notification at its
// date and time, so it arrives even when Day Planner is not open. Needs an account.
export function useReminder(loggedIn: boolean) {
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [deviceReady, setDeviceReady] = useState(false);

    const reload = useCallback(async () => {
        try {
            setReminders(await api.listReminders());
        } catch {
            // Keep what we have; the tasks hook handles a lost login.
        }
    }, []);

    // Load the reminders and check this device. No permission prompt here.
    useEffect(() => {
        if (!loggedIn) return;
        let cancelled = false;

        Promise.all([api.listReminders(), currentSubscription()])
            .then(([loaded, subscription]) => {
                if (cancelled) return;
                setReminders(loaded);
                setDeviceReady(subscription !== null);
            })
            .catch(() => {
                // Shown as empty; the tasks hook handles a lost login.
            });

        return () => {
            cancelled = true;
        };
    }, [loggedIn]);

    // When a reminder arrives while Day Planner is open: play a chime as well
    // (with the app closed, the system's own notification sound is all there is)
    // and refresh the list, because a one-time reminder is gone once it has fired.
    useEffect(() => {
        if (!pushSupported() || !loggedIn) return;

        function onMessage(event: MessageEvent) {
            if (event.data?.type !== 'reminder-shown') return;
            playChime();
            reload();
        }

        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [loggedIn, reload]);

    // Makes this device able to receive notifications. This is the one place that
    // asks for notification permission, and it only runs after a click.
    async function setUpDevice(): Promise<DeviceResult> {
        let permission: NotificationPermission;
        try {
            permission = await orGiveUp(Notification.requestPermission());
        } catch {
            return 'no-answer';
        }
        if (permission !== 'granted') return 'blocked';

        let publicKey: string;
        try {
            publicKey = (await api.getPushPublicKey()).publicKey;
        } catch {
            return 'server';
        }

        let subscription: PushSubscription;
        try {
            subscription = await subscribeThisDevice(publicKey);
        } catch (err) {
            return err instanceof NoAnswerError ? 'no-answer' : 'browser-refused';
        }

        try {
            await api.savePushSubscription(subscription.toJSON());
        } catch {
            return 'server';
        }

        setDeviceReady(true);
        return 'ok';
    }

    // Adds a reminder. Sets up this device first if it is not ready yet.
    async function add(draft: ReminderDraft): Promise<AddResult> {
        if (!deviceReady) {
            const device = await setUpDevice();
            if (device !== 'ok') return device;
        }

        try {
            const created = await api.createReminder({
                ...draft,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
            setReminders((current) =>
                [...current, created].sort(
                    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
                ),
            );
            return 'ok';
        } catch (err) {
            if (err instanceof ApiError && err.code === 'REMINDER_IN_PAST') return 'past';
            if (err instanceof ApiError && err.code === 'TOO_MANY_REMINDERS') return 'limit';
            return 'server';
        }
    }

    // Returns true when the reminder is gone.
    async function remove(id: string) {
        try {
            await api.deleteReminder(id);
        } catch (err) {
            // Already gone (it fired in the meantime) counts as removed.
            if (!(err instanceof ApiError && err.code === 'NOT_FOUND')) return false;
        }
        setReminders((current) => current.filter((r) => r.id !== id));
        return true;
    }

    // Asks the server to push a test notification, then checks that this
    // browser really displayed it.
    async function sendTest(): Promise<TestResult> {
        try {
            const subscription = await currentSubscription();
            if (!subscription) return 'no-device';

            // Make sure the server knows this device (it forgets devices that stop answering).
            await api.savePushSubscription(subscription.toJSON());

            for (const old of await shownNotifications()) old.close();

            const result = await api.sendTestPush();
            if (result.sent === 0) {
                // The push service no longer knows this device; it has to be set up again.
                if (result.removed > 0) return 'no-device';
                // 401/403 from the push service = it does not accept our server's keys.
                const refused = result.failures.some((status) => status === 401 || status === 403);
                return refused ? 'rejected' : 'server';
            }

            const deadline = Date.now() + TEST_WAIT_MS;
            while (Date.now() < deadline) {
                if ((await shownNotifications()).length > 0) return 'shown';
                await wait(500);
            }
            return 'not-shown';
        } catch {
            return 'server';
        }
    }

    return { reminders, deviceReady, add, remove, setUpDevice, sendTest };
}
