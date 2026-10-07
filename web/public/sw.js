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

    event.waitUntil(
        self.registration.showNotification(message.title || 'Day Planner', {
            body: message.body || 'Time to look at your plan.',
            icon: '/favicon.svg',
            // Same tag = a new reminder replaces the old one instead of stacking up.
            tag: 'day-planner-reminder',
        }),
    );
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
