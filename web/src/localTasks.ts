import { api, type Task } from './api';

// Tasks for people who have not signed in. They live in this browser only.
const LOCAL_TASKS_KEY = 'day-planner-guest-tasks';

export function loadLocalTasks(): Task[] {
    try {
        const raw = localStorage.getItem(LOCAL_TASKS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return [];
        // Tasks saved before times existed have no time field.
        return (parsed as Task[]).map((task) => ({ ...task, time: task.time ?? null }));
    } catch {
        return [];
    }
}

export function saveLocalTasks(tasks: Task[]) {
    try {
        localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
    } catch {
        // Storage can be full or blocked; the plan still works for this visit.
    }
}

export function createLocalTask(title: string, date: string, time: string | null): Task {
    return { id: crypto.randomUUID(), title, date, time, done: false };
}

// After sign in: copy the guest tasks into the account, one by one.
// Each task is removed from this browser only once the server has it,
// so a failure halfway never loses or duplicates anything.
export async function moveLocalTasksToAccount() {
    let remaining = loadLocalTasks();

    for (const task of [...remaining]) {
        const created = await api.createTask(task.title, task.date, task.time);
        if (task.done) {
            await api.markDone(created.id);
        }
        remaining = remaining.filter((t) => t.id !== task.id);
        saveLocalTasks(remaining);
    }
}
