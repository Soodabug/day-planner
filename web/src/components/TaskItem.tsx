import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Task, TaskChanges } from '../api';
import { formatDate } from '../lib/dates';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

type Props = {
    task: Task;
    overdue: boolean;
    busy: boolean;
    onUpdate: (id: string, changes: TaskChanges) => Promise<boolean>;
    onDelete: (id: string) => void;
};

export function TaskItem({ task, overdue, busy, onUpdate, onDelete }: Props) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(task.title);
    const [date, setDate] = useState(task.date);

    function startEditing() {
        setTitle(task.title);
        setDate(task.date);
        setEditing(true);
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = title.trim();
        if (!trimmed || !date) return;

        if (trimmed === task.title && date === task.date) {
            setEditing(false);
            return;
        }

        const saved = await onUpdate(task.id, { title: trimmed, date });
        if (saved) setEditing(false);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
        if (event.key === 'Escape') setEditing(false);
    }

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: busy ? 0.6 : 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className={cn(
                'flex items-center gap-3 rounded-md border-2 border-ink bg-paper px-3 py-3',
                overdue && 'border-alarm bg-alarm-soft',
                task.done && 'border-line bg-haze',
                editing && 'border-ink bg-paper shadow-block-sm',
            )}
        >
            {editing ? (
                <form
                    onSubmit={handleSave}
                    onKeyDown={handleKeyDown}
                    aria-label={`Edit "${task.title}"`}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                >
                    <label htmlFor={`edit-title-${task.id}`} className="sr-only">
                        Task
                    </label>
                    <input
                        id={`edit-title-${task.id}`}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                        required
                        className="h-9 min-w-40 flex-1 rounded-md border-2 border-ink bg-paper px-2 font-semibold"
                    />
                    <label htmlFor={`edit-date-${task.id}`} className="sr-only">
                        Date
                    </label>
                    <input
                        id={`edit-date-${task.id}`}
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="h-9 rounded-md border-2 border-ink bg-paper px-2 text-sm font-medium"
                    />
                    <div className="ml-auto flex gap-1">
                        <Button type="submit" size="sm" disabled={busy}>
                            {busy ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                            Cancel
                        </Button>
                    </div>
                </form>
            ) : (
                <>
                    <motion.button
                        // The key restarts the pop animation when the task flips between done and not done.
                        key={task.done ? 'done' : 'open'}
                        type="button"
                        initial={task.done ? { scale: 0.4, rotate: -30 } : false}
                        animate={{ scale: 1, rotate: 0 }}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.8 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                        onClick={() => onUpdate(task.id, { done: !task.done })}
                        disabled={busy}
                        aria-pressed={task.done}
                        aria-label={
                            task.done
                                ? `Mark "${task.title}" as not done`
                                : `Mark "${task.title}" as done`
                        }
                        className={cn(
                            'group flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-ink',
                            task.done ? 'bg-ink text-sun' : 'bg-paper hover:bg-sun',
                            overdue && 'border-alarm',
                        )}
                    >
                        <Check
                            className={cn(
                                'transition-opacity',
                                task.done
                                    ? 'size-5'
                                    : 'size-4 opacity-0 group-hover:opacity-100',
                            )}
                            strokeWidth={3}
                        />
                    </motion.button>

                    <div className="min-w-0 flex-1">
                        <p
                            className={cn(
                                'font-semibold break-words',
                                overdue && 'text-alarm',
                                task.done && 'font-medium text-quiet line-through',
                            )}
                        >
                            {task.title}
                            {task.done && <span className="sr-only"> (done)</span>}
                        </p>
                        <p className={cn('text-sm text-quiet', overdue && 'text-alarm')}>
                            <time dateTime={task.date}>{formatDate(task.date)}</time>
                            {overdue && (
                                <span className="ml-2 rounded-sm bg-alarm px-1.5 py-0.5 text-xs font-semibold text-paper">
                                    Overdue
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex shrink-0">
                        <button
                            type="button"
                            onClick={startEditing}
                            disabled={busy}
                            aria-label={`Edit "${task.title}"`}
                            className="flex size-9 cursor-pointer items-center justify-center rounded-md text-quiet transition-colors hover:bg-ink/10 hover:text-ink"
                        >
                            <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(task.id)}
                            disabled={busy}
                            aria-label={`Delete "${task.title}"`}
                            className="flex size-9 cursor-pointer items-center justify-center rounded-md text-quiet transition-colors hover:bg-alarm-soft hover:text-alarm"
                        >
                            <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                </>
            )}
        </motion.li>
    );
}
