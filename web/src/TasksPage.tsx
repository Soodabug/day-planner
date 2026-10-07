import { useEffect, useState, type FormEvent } from 'react';
import { CalendarCheck, Check, ListTodo, LogOut, Plus, Trash2 } from 'lucide-react';
import { api, ApiError, clearToken, type Task } from './api';
import { ErrorAlert } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { cn } from './lib/utils';

type Props = {
    onLoggedOut: () => void;
};

// Local date as YYYY-MM-DD (same format the API uses).
function dateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysFromToday(offset: number) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return dateString(date);
}

function formatDate(value: string) {
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

export function TasksPage({ onLoggedOut }: Props) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [title, setTitle] = useState('');
    const [date, setDate] = useState(() => daysFromToday(0));
    const [error, setError] = useState('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const [adding, setAdding] = useState(false);
    const [busyIds, setBusyIds] = useState<string[]>([]);

    useEffect(() => {
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
    }, [onLoggedOut, loadAttempt]);

    function retryLoad() {
        setStatus('loading');
        setLoadAttempt((n) => n + 1);
    }

    function logout() {
        clearToken();
        onLoggedOut();
    }

    function handleError(err: unknown) {
        if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
            logout();
        } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
            setError('Enter a title and a valid date.');
        } else if (err instanceof ApiError) {
            setError(err.message);
        } else {
            setError('Could not reach the server.');
        }
    }

    async function handleAdd(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;

        setError('');
        setAdding(true);
        try {
            const newTask = await api.createTask(trimmed, date);
            setTasks((current) => [...current, newTask]);
            setTitle('');
        } catch (err) {
            handleError(err);
        } finally {
            setAdding(false);
        }
    }

    async function handleDone(id: string) {
        setError('');
        setBusyIds((ids) => [...ids, id]);
        try {
            const updated = await api.markDone(id);
            setTasks((current) => current.map((t) => (t.id === id ? updated : t)));
        } catch (err) {
            handleError(err);
        } finally {
            setBusyIds((ids) => ids.filter((x) => x !== id));
        }
    }

    async function handleDelete(id: string) {
        setError('');
        setBusyIds((ids) => [...ids, id]);
        try {
            await api.deleteTask(id);
            setTasks((current) => current.filter((t) => t.id !== id));
        } catch (err) {
            handleError(err);
        } finally {
            setBusyIds((ids) => ids.filter((x) => x !== id));
        }
    }

    const today = daysFromToday(0);
    const sortedTasks = [...tasks].sort((a, b) => a.date.localeCompare(b.date));
    const openCount = tasks.filter((t) => !t.done).length;
    const overdueCount = tasks.filter((t) => !t.done && t.date < today).length;

    return (
        <div className="min-h-svh">
            <header className="border-b">
                <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
                    <p className="flex items-center gap-2 font-semibold tracking-tight">
                        <CalendarCheck className="size-5" aria-hidden="true" />
                        Day Planner
                    </p>
                    <Button type="button" variant="ghost" size="sm" onClick={logout}>
                        <LogOut aria-hidden="true" />
                        Log out
                    </Button>
                </div>
            </header>

            <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {new Date().toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                        })}
                    </h1>
                    {status === 'ready' && tasks.length > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {openCount === 0 ? 'Everything is done' : `${openCount} to do`}
                            {overdueCount > 0 && (
                                <span className="text-destructive">, {overdueCount} overdue</span>
                            )}
                        </p>
                    )}
                </div>

                <form
                    onSubmit={handleAdd}
                    className="flex flex-col gap-3 sm:flex-row sm:items-end"
                    aria-label="Add a task"
                >
                    <div className="flex flex-1 flex-col gap-2">
                        <Label htmlFor="task-title">Task</Label>
                        <Input
                            id="task-title"
                            type="text"
                            placeholder="What do you need to do?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex items-end gap-3">
                        <div className="flex flex-1 flex-col gap-2">
                            <Label htmlFor="task-date">Date</Label>
                            <Input
                                id="task-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="sm:w-40"
                                required
                            />
                        </div>
                        <Button type="submit" disabled={adding}>
                            <Plus aria-hidden="true" />
                            {adding ? 'Adding…' : 'Add task'}
                        </Button>
                    </div>
                </form>

                {error && <ErrorAlert>{error}</ErrorAlert>}

                {status === 'loading' && (
                    <div role="status" className="flex flex-col gap-2">
                        <span className="sr-only">Loading your tasks…</span>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none"
                            />
                        ))}
                    </div>
                )}

                {status === 'failed' && (
                    <ErrorAlert>
                        <span>Could not load your tasks. Check that the server is running.</span>
                        <Button type="button" variant="outline" size="sm" onClick={retryLoad}>
                            Try again
                        </Button>
                    </ErrorAlert>
                )}

                {status === 'ready' && sortedTasks.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-12 text-center">
                        <ListTodo className="size-8 text-muted-foreground" aria-hidden="true" />
                        <p className="font-medium">No tasks yet</p>
                        <p className="text-sm text-muted-foreground">
                            Add your first task above to plan your day.
                        </p>
                    </div>
                )}

                {status === 'ready' && sortedTasks.length > 0 && (
                    <ul className="flex flex-col gap-2" aria-label="Tasks">
                        {sortedTasks.map((task) => {
                            const overdue = !task.done && task.date < today;
                            const busy = busyIds.includes(task.id);

                            return (
                                <li
                                    key={task.id}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5',
                                        overdue && 'border-destructive/50 bg-destructive/5',
                                        task.done && 'bg-muted/50',
                                        busy && 'opacity-60',
                                    )}
                                >
                                    {task.done ? (
                                        <span
                                            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground/70 text-background"
                                            aria-hidden="true"
                                        >
                                            <Check className="size-4" />
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleDone(task.id)}
                                            disabled={busy}
                                            aria-label={`Mark "${task.title}" as done`}
                                            className={cn(
                                                'group flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/60 outline-none transition-colors hover:border-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                                                overdue && 'border-destructive/70 hover:border-destructive',
                                            )}
                                        >
                                            <Check className="size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
                                        </button>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        <p
                                            className={cn(
                                                'font-medium break-words',
                                                overdue && 'text-destructive',
                                                task.done && 'text-muted-foreground line-through',
                                            )}
                                        >
                                            {task.title}
                                            {task.done && <span className="sr-only"> (done)</span>}
                                        </p>
                                        <p
                                            className={cn(
                                                'text-sm text-muted-foreground',
                                                overdue && 'text-destructive',
                                            )}
                                        >
                                            <time dateTime={task.date}>{formatDate(task.date)}</time>
                                            {overdue && (
                                                <span className="ml-2 rounded-sm bg-destructive px-1.5 py-0.5 text-xs font-medium text-background">
                                                    Overdue
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(task.id)}
                                        disabled={busy}
                                        aria-label={`Delete "${task.title}"`}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 aria-hidden="true" />
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </main>
        </div>
    );
}
