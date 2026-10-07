import { useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellRing, LogOut, PartyPopper, Plus } from 'lucide-react';
import { clearToken, type Task } from './api';
import { ReminderDialog } from './components/ReminderDialog';
import { TaskItem } from './components/TaskItem';
import { ErrorAlert } from './components/ui/alert';
import { Button } from './components/ui/button';
import { useReminder } from './hooks/useReminder';
import { useTasks } from './hooks/useTasks';
import { daysFromToday, greeting } from './lib/dates';
import { cn } from './lib/utils';

type Props = {
    loggedIn: boolean;
    onSignIn: () => void;
    onLoggedOut: () => void;
};

const IDEAS = ['Go for a 20 minute walk', 'Tidy my desk', 'Message a friend', 'Read 10 pages'];

function encouragement(total: number, done: number) {
    if (total === 0) return 'Write down one thing. Small plans count.';
    if (done === 0) return 'Pick the easiest one and start there.';
    if (done < total) return 'You are moving. Keep going.';
    return 'Everything for today is done.';
}

export function PlannerPage({ loggedIn, onSignIn, onLoggedOut }: Props) {
    const { tasks, status, error, busyIds, retry, add, complete, remove } = useTasks(
        loggedIn,
        onLoggedOut,
    );
    const reminder = useReminder(tasks);

    const [title, setTitle] = useState('');
    const [date, setDate] = useState(() => daysFromToday(0));
    const [adding, setAdding] = useState(false);
    const [reminderOpen, setReminderOpen] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);

    const today = daysFromToday(0);
    const tomorrow = daysFromToday(1);

    async function addTask(taskTitle: string, taskDate: string) {
        const trimmed = taskTitle.trim();
        if (!trimmed) return;

        setAdding(true);
        const added = await add(trimmed, taskDate);
        setAdding(false);

        if (added) {
            setTitle('');
            setDate(daysFromToday(0));
        }
        titleRef.current?.focus();
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        addTask(title, date);
    }

    function logout() {
        clearToken();
        onLoggedOut();
    }

    const byDate = (a: Task, b: Task) => a.date.localeCompare(b.date);
    const open = tasks.filter((t) => !t.done).sort(byDate);
    const sections = [
        { name: 'Overdue', tasks: open.filter((t) => t.date < today), overdue: true },
        { name: 'Today', tasks: open.filter((t) => t.date === today), overdue: false },
        { name: 'Coming up', tasks: open.filter((t) => t.date > today), overdue: false },
        { name: 'Done', tasks: tasks.filter((t) => t.done).sort(byDate), overdue: false },
    ].filter((section) => section.tasks.length > 0);

    const todayTasks = tasks.filter((t) => t.date === today);
    const todayDone = todayTasks.filter((t) => t.done).length;
    const allDoneToday = todayTasks.length > 0 && todayDone === todayTasks.length;
    const progress = todayTasks.length === 0 ? 0 : todayDone / todayTasks.length;

    return (
        <div className="min-h-svh">
            <div className="bg-sun">
                <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
                    <p className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight whitespace-nowrap">
                        <span className="flex size-7 items-center justify-center rounded-md bg-ink text-sun">
                            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                                <path
                                    d="M5 12.5l4.5 4.5L19 7"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </span>
                        Day Planner
                    </p>

                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReminderOpen(true)}
                            aria-label={
                                reminder.active
                                    ? `Daily reminder at ${reminder.settings.time}`
                                    : 'Set a daily reminder'
                            }
                        >
                            {reminder.active ? (
                                <BellRing aria-hidden="true" />
                            ) : (
                                <Bell aria-hidden="true" />
                            )}
                            <span className="hidden sm:inline">
                                {reminder.active ? `Daily at ${reminder.settings.time}` : 'Remind me'}
                            </span>
                        </Button>
                        {loggedIn ? (
                            <Button variant="ghost" size="sm" onClick={logout}>
                                <LogOut aria-hidden="true" />
                                Log out
                            </Button>
                        ) : (
                            <Button size="sm" onClick={onSignIn}>
                                Sign in
                            </Button>
                        )}
                    </div>
                </header>

                <div className="mx-auto max-w-3xl px-4 pt-8 pb-12 sm:pt-14 sm:pb-16">
                    <motion.h1
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                        className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl"
                    >
                        {greeting()}
                        <br />
                        What’s the plan?
                    </motion.h1>

                    <motion.form
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.08 }}
                        onSubmit={handleSubmit}
                        aria-label="Add a task"
                        className="mt-8 rounded-lg border-2 border-ink bg-paper p-3 shadow-block sm:p-4"
                    >
                        <label htmlFor="task-title" className="sr-only">
                            Task
                        </label>
                        <input
                            id="task-title"
                            ref={titleRef}
                            type="text"
                            placeholder="Today I will…"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoComplete="off"
                            required
                            className="w-full bg-transparent px-1 py-2 font-display text-2xl font-bold placeholder:text-quiet/70 focus-visible:outline-none sm:text-3xl"
                        />

                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-line pt-3">
                            <DateChip
                                label="Today"
                                selected={date === today}
                                onClick={() => setDate(today)}
                            />
                            <DateChip
                                label="Tomorrow"
                                selected={date === tomorrow}
                                onClick={() => setDate(tomorrow)}
                            />
                            <label htmlFor="task-date" className="sr-only">
                                Date
                            </label>
                            <input
                                id="task-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className={cn(
                                    'h-9 rounded-md border-2 border-line bg-paper px-2 text-sm font-medium',
                                    date !== today && date !== tomorrow && 'border-ink bg-sun',
                                )}
                            />

                            <Button type="submit" disabled={adding} className="ml-auto">
                                <Plus aria-hidden="true" />
                                {adding ? 'Adding…' : 'Add to plan'}
                            </Button>
                        </div>
                    </motion.form>

                    {!loggedIn && tasks.length > 0 && (
                        <p className="mt-4 text-sm font-medium">
                            Saved in this browser.{' '}
                            <Button variant="link" onClick={onSignIn}>
                                Sign in to keep it everywhere
                            </Button>
                        </p>
                    )}
                </div>
            </div>

            <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
                {error && <ErrorAlert>{error}</ErrorAlert>}

                {status === 'loading' && (
                    <div role="status" className="flex flex-col gap-2">
                        <span className="sr-only">Loading your plan…</span>
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-16 animate-pulse rounded-md bg-haze motion-reduce:animate-none"
                            />
                        ))}
                    </div>
                )}

                {status === 'failed' && (
                    <ErrorAlert>
                        <span>Could not load your plan. Check that the server is running.</span>
                        <Button variant="outline" size="sm" onClick={retry}>
                            Try again
                        </Button>
                    </ErrorAlert>
                )}

                {status === 'ready' && (
                    <section aria-label="Today's progress">
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="font-display text-xl font-bold tracking-tight">
                                {new Date().toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </p>
                            <p className="text-sm font-semibold tabular-nums">
                                {todayTasks.length === 0
                                    ? 'Nothing planned today'
                                    : `${todayDone} of ${todayTasks.length} done today`}
                            </p>
                        </div>
                        <div
                            className="mt-3 h-4 overflow-hidden rounded-full border-2 border-ink bg-paper"
                            role="progressbar"
                            aria-label="Today's tasks done"
                            aria-valuemin={0}
                            aria-valuemax={todayTasks.length}
                            aria-valuenow={todayDone}
                        >
                            <motion.div
                                className="h-full bg-sun"
                                initial={false}
                                animate={{ width: `${progress * 100}%` }}
                                transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                            />
                        </div>

                        <AnimatePresence mode="wait" initial={false}>
                            {allDoneToday ? (
                                <motion.p
                                    key="done"
                                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                                    className="mt-4 flex items-center gap-3 rounded-md border-2 border-ink bg-sun px-4 py-3 font-display text-lg font-bold shadow-block-sm"
                                >
                                    <motion.span
                                        animate={{ rotate: [0, -18, 14, -8, 0], scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.7, delay: 0.1 }}
                                        aria-hidden="true"
                                    >
                                        <PartyPopper className="size-6" />
                                    </motion.span>
                                    Today’s plan is done. Enjoy the rest of your day.
                                </motion.p>
                            ) : (
                                <motion.p
                                    key={`${todayTasks.length}-${todayDone}`}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="mt-3 text-quiet"
                                >
                                    {encouragement(todayTasks.length, todayDone)}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </section>
                )}

                {status === 'ready' && tasks.length === 0 && (
                    <section className="rounded-lg border-2 border-dashed border-ink/40 px-4 py-8 text-center">
                        <h2 className="font-display text-2xl font-bold tracking-tight">
                            Your day is a blank page
                        </h2>
                        <p className="mt-1 text-quiet">
                            Type a plan above, or start with one of these.
                        </p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            {IDEAS.map((idea) => (
                                <Button
                                    key={idea}
                                    variant="sun"
                                    size="sm"
                                    onClick={() => addTask(idea, today)}
                                >
                                    <Plus aria-hidden="true" />
                                    {idea}
                                </Button>
                            ))}
                        </div>
                    </section>
                )}

                {status === 'ready' &&
                    sections.map((section) => (
                        <section key={section.name} aria-labelledby={`section-${section.name}`}>
                            <h2
                                id={`section-${section.name}`}
                                className={cn(
                                    'mb-3 flex items-center gap-2 font-display text-xl font-bold tracking-tight',
                                    section.overdue && 'text-alarm',
                                )}
                            >
                                {section.name}
                                <span
                                    className={cn(
                                        'rounded-full bg-ink px-2 py-0.5 font-sans text-xs font-semibold text-paper tabular-nums',
                                        section.overdue && 'bg-alarm',
                                    )}
                                >
                                    {section.tasks.length}
                                </span>
                            </h2>
                            <ul className="flex flex-col gap-2">
                                <AnimatePresence initial={false} mode="popLayout">
                                    {section.tasks.map((task) => (
                                        <TaskItem
                                            key={task.id}
                                            task={task}
                                            overdue={section.overdue}
                                            busy={busyIds.includes(task.id)}
                                            onDone={complete}
                                            onDelete={remove}
                                        />
                                    ))}
                                </AnimatePresence>
                            </ul>
                        </section>
                    ))}
            </main>

            <ReminderDialog
                open={reminderOpen}
                onClose={() => setReminderOpen(false)}
                settings={reminder.settings}
                permission={reminder.permission}
                active={reminder.active}
                onEnable={reminder.enable}
                onDisable={reminder.disable}
                onSendTest={reminder.sendTest}
            />
        </div>
    );
}

type DateChipProps = {
    label: string;
    selected: boolean;
    onClick: () => void;
};

function DateChip({ label, selected, onClick }: DateChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'h-9 cursor-pointer rounded-md border-2 border-line bg-paper px-3 text-sm font-semibold transition-colors hover:border-ink',
                selected && 'border-ink bg-sun',
            )}
        >
            {label}
        </button>
    );
}
