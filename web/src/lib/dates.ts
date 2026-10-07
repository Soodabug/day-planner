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
