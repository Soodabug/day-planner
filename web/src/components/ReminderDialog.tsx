import { useState, type FormEvent } from 'react';
import { BellPlus, Repeat, Trash2 } from 'lucide-react';
import type { Reminder } from '../api';
import {
    pushSupported,
    type AddResult,
    type DeviceResult,
    type ReminderDraft,
    type TestResult,
} from '../hooks/useReminder';
import { dateString, daysFromToday, formatDate } from '../lib/dates';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

type Props = {
    open: boolean;
    onClose: () => void;
    loggedIn: boolean;
    onSignIn: () => void;
    reminders: Reminder[];
    deviceReady: boolean;
    onAdd: (draft: ReminderDraft) => Promise<AddResult>;
    onRemove: (id: string) => Promise<boolean>;
    onSetUpDevice: () => Promise<DeviceResult>;
    onSendTest: () => Promise<TestResult>;
};

export function ReminderDialog({ open, onClose, loggedIn, onSignIn, ...form }: Props) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Reminders"
            description="Write what you want to be reminded of and when. The notification arrives even when Day Planner is closed."
        >
            {!pushSupported() ? (
                <ErrorAlert>This browser does not support push notifications.</ErrorAlert>
            ) : !loggedIn ? (
                <div className="flex flex-col gap-4">
                    <p className="text-sm">
                        Reminders are sent to your account, so they need you to be signed in.
                    </p>
                    <Button
                        variant="sun"
                        onClick={() => {
                            onClose();
                            onSignIn();
                        }}
                    >
                        Sign in to get reminders
                    </Button>
                </div>
            ) : (
                // Rendered only while the dialog is open, so the form starts fresh each time.
                <ReminderForm {...form} />
            )}
        </Dialog>
    );
}

const DEVICE_PROBLEMS: Record<Exclude<DeviceResult, 'ok'>, string> = {
    blocked:
        'Notifications are blocked for this site. Click the icon left of the address bar, set Notifications to Allow, reload the page and try again.',
    'no-answer':
        'Your browser did not answer the request for push notifications. Push may be switched off in its settings (in Brave: Settings, Privacy, "Use Google services for push messaging"). Try Chrome, Edge or Firefox.',
    'browser-refused':
        'Your browser refused to set up push notifications. Private windows and some browsers do not support them. Try a normal window in Chrome, Edge or Firefox.',
    server: 'Could not reach the server. Wait a moment (it may be waking up) and try again.',
};

const ADD_PROBLEMS: Record<Exclude<AddResult, 'ok'>, string> = {
    ...DEVICE_PROBLEMS,
    past: 'That date and time have already passed. Pick a later time.',
    limit: 'You have too many reminders. Delete one first.',
};

const TEST_PROBLEMS: Record<Exclude<TestResult, 'shown'>, string> = {
    'not-shown':
        'The test was sent, but this browser did not show it within 12 seconds. Check that notifications are allowed for your browser in your system settings, then try again.',
    'no-device': 'This device is not set up for reminders yet. Click "Get reminders on this device".',
    rejected:
        'The push service refused the server (code 401/403). The VAPID keys on the server do not match: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be a pair.',
    server: 'The test could not be sent. Wait a moment (the server may be waking up) and try again.',
};

// The next full hour, e.g. 14:00 when it is 13:20. Late evening falls back to 23:59.
function nextFullHour() {
    const hour = new Date().getHours() + 1;
    return hour > 23 ? '23:59' : `${String(hour).padStart(2, '0')}:00`;
}

// "Today at 14:30", "Fri, Oct 9 at 08:00", "Every day at 08:00"
function whenText(reminder: Reminder) {
    if (!reminder.repeatDaily) return `${formatDate(reminder.date)} at ${reminder.time}`;
    if (reminder.date > dateString(new Date())) {
        return `Every day at ${reminder.time}, from ${formatDate(reminder.date).toLowerCase()}`;
    }
    return `Every day at ${reminder.time}`;
}

type FormProps = Omit<Props, 'open' | 'onClose' | 'loggedIn' | 'onSignIn'>;

function ReminderForm({
    reminders,
    deviceReady,
    onAdd,
    onRemove,
    onSetUpDevice,
    onSendTest,
}: FormProps) {
    const [text, setText] = useState('');
    const [date, setDate] = useState(() => daysFromToday(0));
    const [time, setTime] = useState(nextFullHour);
    const [repeatDaily, setRepeatDaily] = useState(false);
    const [message, setMessage] = useState('');
    const [problem, setProblem] = useState('');
    const [working, setWorking] = useState(false);

    async function run(action: () => Promise<void>) {
        setMessage('');
        setProblem('');
        setWorking(true);
        await action();
        setWorking(false);
    }

    function handleAdd(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;

        run(async () => {
            const result = await onAdd({ text: trimmed, date, time, repeatDaily });
            if (result === 'ok') {
                setText('');
                setMessage('Reminder added.');
            } else {
                setProblem(ADD_PROBLEMS[result]);
            }
        });
    }

    function handleRemove(id: string) {
        return run(async () => {
            if (!(await onRemove(id))) {
                setProblem('Could not delete the reminder. Check your connection and try again.');
            }
        });
    }

    function handleSetUpDevice() {
        return run(async () => {
            const result = await onSetUpDevice();
            if (result === 'ok') {
                setMessage('This device will now get your reminders.');
            } else {
                setProblem(DEVICE_PROBLEMS[result]);
            }
        });
    }

    function handleTest() {
        return run(async () => {
            setMessage('Sending a test and waiting for it to arrive…');
            const result = await onSendTest();
            if (result === 'shown') {
                setMessage(
                    'It works: the test notification arrived on this device. If you did not see or hear it, your system is hiding it (check Do Not Disturb and the notification settings for your browser).',
                );
            } else {
                setMessage('');
                setProblem(TEST_PROBLEMS[result]);
            }
        });
    }

    return (
        <div className="flex flex-col gap-5">
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="reminder-text" className="text-sm font-semibold">
                        Remind me to
                    </label>
                    <Input
                        id="reminder-text"
                        type="text"
                        placeholder="Call the dentist"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={120}
                        required
                    />
                </div>

                <div className="flex gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <label htmlFor="reminder-date" className="text-sm font-semibold">
                            {repeatDaily ? 'Starting' : 'On'}
                        </label>
                        <Input
                            id="reminder-date"
                            type="date"
                            value={date}
                            min={daysFromToday(0)}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor="reminder-time" className="text-sm font-semibold">
                            At
                        </label>
                        <Input
                            id="reminder-time"
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                        type="checkbox"
                        checked={repeatDaily}
                        onChange={(e) => setRepeatDaily(e.target.checked)}
                        className="size-4 accent-ink"
                    />
                    Repeat every day
                </label>

                <Button type="submit" variant="sun" disabled={working}>
                    <BellPlus aria-hidden="true" />
                    Add reminder
                </Button>
            </form>

            {message && (
                <p role="status" className="text-sm font-medium">
                    {message}
                </p>
            )}
            {problem && <ErrorAlert>{problem}</ErrorAlert>}

            <section aria-labelledby="reminder-list-title">
                <h3 id="reminder-list-title" className="mb-2 text-sm font-semibold">
                    Coming up
                </h3>
                {reminders.length === 0 ? (
                    <p className="rounded-md border-2 border-dashed border-ink/40 px-3 py-4 text-center text-sm text-quiet">
                        No reminders yet. Add your first one above.
                    </p>
                ) : (
                    <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                        {reminders.map((reminder) => (
                            <li
                                key={reminder.id}
                                className="flex items-center gap-2 rounded-md border-2 border-ink px-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold break-words">{reminder.text}</p>
                                    <p className="flex items-center gap-1 text-sm text-quiet">
                                        {reminder.repeatDaily && (
                                            <Repeat className="size-3.5" aria-hidden="true" />
                                        )}
                                        {whenText(reminder)}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(reminder.id)}
                                    disabled={working}
                                    aria-label={`Delete reminder "${reminder.text}"`}
                                    className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-quiet transition-colors hover:bg-alarm-soft hover:text-alarm"
                                >
                                    <Trash2 className="size-4" aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="flex flex-col gap-2 border-t-2 border-line pt-4">
                {deviceReady ? (
                    <Button variant="outline" size="sm" onClick={handleTest} disabled={working}>
                        Send a test notification
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSetUpDevice}
                        disabled={working}
                    >
                        Get reminders on this device
                    </Button>
                )}
                <p className="text-xs text-quiet">
                    A reminder can arrive a few minutes late. The sound is your system’s
                    notification sound, so keep that on.
                </p>
            </div>
        </div>
    );
}
