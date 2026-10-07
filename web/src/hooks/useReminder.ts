import { useEffect, useRef, useState } from 'react';
import type { Task } from '../api';
import { daysFromToday } from '../lib/dates';

const SETTINGS_KEY = 'day-planner-reminder';
const LAST_SENT_KEY = 'day-planner-reminder-last';
const CHECK_EVERY_MS = 20_000;

export type ReminderSettings = {
    enabled: boolean;
    time: string; // HH:MM, 24h
};

function loadSettings(): ReminderSettings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed.enabled === 'boolean' && typeof parsed.time === 'string') {
            return parsed;
        }
    } catch {
        // fall through to the default
    }
    return { enabled: false, time: '09:00' };
}

function currentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function notificationsSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function reminderText(tasks: Task[]) {
    const today = daysFromToday(0);
    const open = tasks.filter((t) => !t.done);
    const dueToday = open.filter((t) => t.date === today);
    const overdue = open.filter((t) => t.date < today);

    if (dueToday.length === 0 && overdue.length === 0) {
        return {
            title: 'What is the plan today?',
            body: 'Nothing planned yet. Write down one thing you want to get done.',
        };
    }

    const parts: string[] = [];
    if (dueToday.length > 0) parts.push(`${dueToday.length} for today`);
    if (overdue.length > 0) parts.push(`${overdue.length} overdue`);

    const first = [...overdue, ...dueToday][0];
    return {
        title: `Your plan: ${parts.join(', ')}`,
        body: `Start with "${first.title}".`,
    };
}

// Returns false when the browser refused to show it.
function show(title: string, body: string) {
    try {
        new Notification(title, { body, icon: '/favicon.svg', tag: 'day-planner-daily' });
        return true;
    } catch {
        return false;
    }
}

// A daily browser notification with today's plan.
// It can only fire while Day Planner is open in a tab.
export function useReminder(tasks: Task[]) {
    const [settings, setSettings] = useState<ReminderSettings>(loadSettings);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
        notificationsSupported() ? Notification.permission : 'unsupported',
    );

    const tasksRef = useRef(tasks);
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    const active = settings.enabled && permission === 'granted';

    useEffect(() => {
        if (!active) return;

        function check() {
            const today = daysFromToday(0);
            if (localStorage.getItem(LAST_SENT_KEY) === today) return;
            if (currentTime() < settings.time) return;

            const { title, body } = reminderText(tasksRef.current);
            if (show(title, body)) {
                localStorage.setItem(LAST_SENT_KEY, today);
            }
        }

        check();
        const timer = setInterval(check, CHECK_EVERY_MS);
        return () => clearInterval(timer);
    }, [active, settings.time]);

    function save(next: ReminderSettings) {
        setSettings(next);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));

        // If today's time is already behind us, start tomorrow instead of firing right away.
        if (next.enabled && currentTime() >= next.time) {
            localStorage.setItem(LAST_SENT_KEY, daysFromToday(0));
        } else {
            localStorage.removeItem(LAST_SENT_KEY);
        }
    }

    // Asks the browser for permission if needed. Returns true when reminders are on.
    async function enable(time: string) {
        if (!notificationsSupported()) return false;

        const result =
            Notification.permission === 'granted'
                ? 'granted'
                : await Notification.requestPermission();
        setPermission(result);

        if (result !== 'granted') return false;
        save({ enabled: true, time });
        return true;
    }

    function disable() {
        save({ ...settings, enabled: false });
    }

    function sendTest() {
        const { title, body } = reminderText(tasksRef.current);
        return show(title, body);
    }

    return { settings, permission, active, enable, disable, sendTest };
}
