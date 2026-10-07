const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'day-planner-token';

export type Task = {
    id: string;
    title: string;
    date: string;
    done: boolean;
};

export type TaskChanges = Partial<Pick<Task, 'title' | 'date' | 'done'>>;

// The daily reminder of the logged-in user. timezone is null until it is first saved.
export type Reminder = {
    enabled: boolean;
    time: string; // HH:MM, 24h
    timezone: string | null;
};

export type User = {
    id: string;
    email: string;
};

type AuthResponse = {
    token: string;
    user: User;
};

export class ApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_URL + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new ApiError(response.status, data.error.code, data.error.message);
    }

    return data as T;
}

export const api = {
    signup: (email: string, password: string) =>
        request<AuthResponse>('POST', '/auth/signup', { email, password }),

    login: (email: string, password: string) =>
        request<AuthResponse>('POST', '/auth/login', { email, password }),

    listTasks: () =>
        request<Task[]>('GET', '/tasks'),

    createTask: (title: string, date: string) =>
        request<Task>('POST', '/tasks', { title, date }),

    // Send only the fields that should change.
    updateTask: (id: string, changes: TaskChanges) =>
        request<Task>('PUT', `/tasks/${id}`, changes),

    deleteTask: (id: string) =>
        request<{ message: string }>('DELETE', `/tasks/${id}`),

    // ----- reminders (web push) -----

    getPushPublicKey: () =>
        request<{ publicKey: string }>('GET', '/push/public-key'),

    // subscription = what the browser's PushSubscription.toJSON() returns
    savePushSubscription: (subscription: PushSubscriptionJSON) =>
        request<{ message: string }>('POST', '/push/subscriptions', subscription),

    deletePushSubscription: (endpoint: string) =>
        request<{ message: string }>('DELETE', '/push/subscriptions', { endpoint }),

    getReminder: () =>
        request<Reminder>('GET', '/reminder'),

    saveReminder: (reminder: { enabled: boolean; time: string; timezone: string }) =>
        request<Reminder>('PUT', '/reminder', reminder),

    sendTestPush: () =>
        request<{ devices: number; sent: number; removed: number; failures: number[] }>(
            'POST',
            '/push/test',
        ),
};