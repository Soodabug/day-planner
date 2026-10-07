import { motion } from 'motion/react';
import { Check, Trash2 } from 'lucide-react';
import type { Task } from '../api';
import { formatDate } from '../lib/dates';
import { cn } from '../lib/utils';

type Props = {
    task: Task;
    overdue: boolean;
    busy: boolean;
    onDone: (id: string) => void;
    onDelete: (id: string) => void;
};

export function TaskItem({ task, overdue, busy, onDone, onDelete }: Props) {
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
            )}
        >
            {task.done ? (
                <motion.span
                    initial={{ scale: 0.4, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-sun"
                    aria-hidden="true"
                >
                    <Check className="size-5" strokeWidth={3} />
                </motion.span>
            ) : (
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.8 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    onClick={() => onDone(task.id)}
                    disabled={busy}
                    aria-label={`Mark "${task.title}" as done`}
                    className={cn(
                        'group flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-ink bg-paper hover:bg-sun',
                        overdue && 'border-alarm',
                    )}
                >
                    <Check
                        className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
                        strokeWidth={3}
                    />
                </motion.button>
            )}

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

            <button
                type="button"
                onClick={() => onDelete(task.id)}
                disabled={busy}
                aria-label={`Delete "${task.title}"`}
                className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-quiet transition-colors hover:bg-alarm-soft hover:text-alarm"
            >
                <Trash2 className="size-4" aria-hidden="true" />
            </button>
        </motion.li>
    );
}
