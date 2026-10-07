// Local date as YYYY-MM-DD (same format the API uses).
export function dateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function daysFromToday(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return dateString(date);
}

export function formatDate(value: string) {
    if (value === daysFromToday(0)) return 'Today';
    if (value === daysFromToday(1)) return 'Tomorrow';
    if (value === daysFromToday(-1)) return 'Yesterday';

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: year === new Date().getFullYear() ? undefined : 'numeric',
    });
}

export function greeting() {
    const hour = new Date().getHours();
    if (hour < 5) return 'Still up?';
    if (hour < 12) return 'Good morning.';
    if (hour < 18) return 'Good afternoon.';
    return 'Good evening.';
}

// Current local time as HH:MM (24h), comparable with task times as plain strings.
export function currentTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// "14:30" -> "2:30 PM" (or "14:30", depending on the user's locale).
export function formatTime(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Earliest first. On the same day, tasks with a time come before tasks without one.
export function byDateAndTime(
    a: { date: string; time: string | null },
    b: { date: string; time: string | null },
) {
    return a.date.localeCompare(b.date) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
}
