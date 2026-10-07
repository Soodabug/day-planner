import { useEffect, useState } from 'react';
import type { Task } from '../api';
import { currentTime, daysFromToday, formatTime } from '../lib/dates';

const SETTINGS_KEY = 'day-planner-reminder';
const LAST_SENT_KEY = 'day-planner-reminder-last';
const NOTIFIED_TASKS_KEY = 'day-planner-notified-tasks';
const CHECK_EVERY_MS = 20_000;
// A task whose time passed longer ago than this (app was closed) is skipped, not announced late.
const MAX_MINUTES_LATE = 15;

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

function loadNotifiedTasks(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(NOTIFIED_TASKS_KEY) ?? '[]');
        return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
        return [];
    }
}

function minutesOfDay(time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

export function notificationsSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

function summaryText(tasks: Task[]) {
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
function show(title: string, body: string, tag: string) {
    try {
        new Notification(title, { body, icon: '/favicon.svg', tag });
        return true;
    } catch {
        return false;
    }
}

// Announces every open task planned for today whose time has arrived, once.
function notifyDueTasks(tasks: Task[]) {
    const today = daysFromToday(0);
    const now = currentTime();
    // Entries look like "<date>|<id>|<time>"; older days are dropped here.
    const notified = loadNotifiedTasks().filter((key) => key.startsWith(today));
    let changed = false;

    for (const task of tasks) {
        if (task.done || task.date !== today || !task.time || task.time > now) continue;

        const key = `${today}|${task.id}|${task.time}`;
        if (notified.includes(key)) continue;

        const minutesLate = minutesOfDay(now) - minutesOfDay(task.time);
        const shown =
            minutesLate > MAX_MINUTES_LATE ||
            show(task.title, `Planned for ${formatTime(task.time)}. Time to start.`, `day-planner-task-${task.id}`);

        if (shown) {
            notified.push(key);
            changed = true;
        }
    }

    if (changed) localStorage.setItem(NOTIFIED_TASKS_KEY, JSON.stringify(notified));
}

// Browser notifications: one per task at its time, plus an optional daily summary.
// They can only fire while Day Planner is open in a tab.
export function useReminder(tasks: Task[]) {
    const [settings, setSettings] = useState<ReminderSettings>(loadSettings);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
        notificationsSupported() ? Notification.permission : 'unsupported',
    );

    const allowed = permission === 'granted';
    const active = settings.enabled && allowed;

    // Checks right away (also whenever the tasks change), then every few seconds.
    useEffect(() => {
        if (!allowed) return;

        function check() {
            notifyDueTasks(tasks);

            if (!settings.enabled) return;
            const today = daysFromToday(0);
            if (localStorage.getItem(LAST_SENT_KEY) === today) return;
            if (currentTime() < settings.time) return;

            const { title, body } = summaryText(tasks);
            if (show(title, body, 'day-planner-daily')) {
                localStorage.setItem(LAST_SENT_KEY, today);
            }
        }

        check();
        const timer = setInterval(check, CHECK_EVERY_MS);
        return () => clearInterval(timer);
    }, [allowed, settings.enabled, settings.time, tasks]);

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

    // Asks the browser for permission if it has not been decided yet.
    // Returns true when notifications are allowed.
    async function askPermission() {
        if (!notificationsSupported()) return false;

        const result =
            Notification.permission === 'default'
                ? await Notification.requestPermission()
                : Notification.permission;
        setPermission(result);
        return result === 'granted';
    }

    // Turns on the daily summary. Returns true when it is on.
    async function enable(time: string) {
        if (!(await askPermission())) return false;
        save({ enabled: true, time });
        return true;
    }

    function disable() {
        save({ ...settings, enabled: false });
    }

    function sendTest() {
        const { title, body } = summaryText(tasks);
        return show(title, body, 'day-planner-test');
    }

    return { settings, permission, active, askPermission, enable, disable, sendTest };
}
