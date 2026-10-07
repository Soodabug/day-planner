import { useEffect, useState } from 'react';
import { api, ApiError, clearToken, type Task } from '../api';
import { createLocalTask, loadLocalTasks, saveLocalTasks } from '../localTasks';

type Status = 'loading' | 'ready' | 'failed';

// One task list, two homes: the account (API) when signed in,
// this browser (localStorage) when not.
export function useTasks(loggedIn: boolean, onLoggedOut: () => void) {
    const [tasks, setTasks] = useState<Task[]>(() => (loggedIn ? [] : loadLocalTasks()));
    const [status, setStatus] = useState<Status>(loggedIn ? 'loading' : 'ready');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [error, setError] = useState('');
    const [busyIds, setBusyIds] = useState<string[]>([]);

    useEffect(() => {
        if (!loggedIn) return;
        let cancelled = false;

        api
            .listTasks()
            .then((loaded) => {
                if (cancelled) return;
                setTasks(loaded);
                setStatus('ready');
            })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
                    clearToken();
                    onLoggedOut();
                } else {
                    setStatus('failed');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [loggedIn, onLoggedOut, loadAttempt]);

    function retry() {
        setStatus('loading');
        setLoadAttempt((n) => n + 1);
    }

    function handleError(err: unknown) {
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
            clearToken();
            onLoggedOut();
        } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
            setError('Enter a title and a valid date.');
        } else if (err instanceof ApiError) {
            setError(err.message);
        } else {
            setError('Could not reach the server.');
        }
    }

    // Guest tasks are written to this browser whenever they change.
    useEffect(() => {
        if (!loggedIn) saveLocalTasks(tasks);
    }, [loggedIn, tasks]);

    async function withBusy(id: string, action: () => Promise<void>) {
        setError('');
        setBusyIds((ids) => [...ids, id]);
        try {
            await action();
        } catch (err) {
            handleError(err);
        } finally {
            setBusyIds((ids) => ids.filter((x) => x !== id));
        }
    }

    // Returns true when the task was added.
    async function add(title: string, date: string) {
        setError('');

        if (!loggedIn) {
            setTasks((current) => [...current, createLocalTask(title, date)]);
            return true;
        }

        try {
            const newTask = await api.createTask(title, date);
            setTasks((current) => [...current, newTask]);
            return true;
        } catch (err) {
            handleError(err);
            return false;
        }
    }

    async function complete(id: string) {
        if (!loggedIn) {
            setTasks((current) => current.map((t) => (t.id === id ? { ...t, done: true } : t)));
            return;
        }

        await withBusy(id, async () => {
            const updated = await api.markDone(id);
            setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
        });
    }

    async function remove(id: string) {
        if (!loggedIn) {
            setTasks((current) => current.filter((t) => t.id !== id));
            return;
        }

        await withBusy(id, async () => {
            await api.deleteTask(id);
            setTasks((current) => current.filter((t) => t.id !== id));
        });
    }

    return { tasks, status, error, busyIds, retry, add, complete, remove };
}
