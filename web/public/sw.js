// Day Planner service worker.
// Its only job: show the reminder the server pushes, even when no tab is open.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let message = {};
    try {
        message = event.data ? event.data.json() : {};
    } catch {
        // Not JSON: fall back to the default text below.
    }

    const show = self.registration.showNotification(message.title || 'Day Planner', {
        body: message.body || 'Time to look at your plan.',
        icon: '/favicon.svg',
        // Same tag = a new reminder replaces the old one instead of stacking up...
        tag: 'day-planner-reminder',
        // ...and renotify makes the replacement alert again (sound, banner) instead of updating silently.
        renotify: true,
        silent: false,
        // Stay on screen until the user reacts, so it is not missed.
        requireInteraction: true,
        // Phones: buzz twice.
        vibrate: [200, 100, 200],
    });

    // The system plays its own notification sound. Open Day Planner tabs also play a chime.
    const tellOpenTabs = self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) => {
            for (const w of windows) w.postMessage({ type: 'reminder-shown' });
        });

    event.waitUntil(Promise.all([show, tellOpenTabs]));
});

// Clicking the notification brings Day Planner to the front, or opens it.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const open = windows.find((w) => 'focus' in w);
            return open ? open.focus() : self.clients.openWindow('/');
        }),
    );
});
