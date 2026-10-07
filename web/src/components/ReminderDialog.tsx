import { useState } from 'react';
import { BellRing } from 'lucide-react';
import {
    pushSupported,
    type EnableResult,
    type ReminderSettings,
    type TestResult,
} from '../hooks/useReminder';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

type Props = {
    open: boolean;
    onClose: () => void;
    loggedIn: boolean;
    onSignIn: () => void;
    settings: ReminderSettings;
    active: boolean;
    onEnable: (time: string) => Promise<EnableResult>;
    onDisable: () => Promise<boolean>;
    onSendTest: () => Promise<TestResult>;
};

export function ReminderDialog({ open, onClose, loggedIn, onSignIn, ...form }: Props) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Daily reminder"
            description="One notification a day with what is on your plan and what to start with. It arrives even when Day Planner is closed."
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
                // Rendered only while the dialog is open, so it starts from the saved time.
                <ReminderForm {...form} />
            )}
        </Dialog>
    );
}

const ENABLE_PROBLEMS: Record<Exclude<EnableResult, 'ok'>, string> = {
    blocked:
        'Notifications are blocked for this site. Click the icon left of the address bar, set Notifications to Allow, reload the page and try again.',
    'no-answer':
        'Your browser did not answer the request for push notifications. Push may be switched off in its settings (in Brave: Settings, Privacy, "Use Google services for push messaging"). Try Chrome, Edge or Firefox.',
    'browser-refused':
        'Your browser refused to set up push notifications. Private windows and some browsers do not support them. Try a normal window in Chrome, Edge or Firefox.',
    server: 'Could not reach the server. Wait a moment (it may be waking up) and try again.',
};

const TEST_PROBLEMS: Record<Exclude<TestResult, 'shown'>, string> = {
    'not-shown':
        'The test was sent, but this browser did not show it within 12 seconds. Check that notifications are allowed for your browser in your system settings, then try again.',
    'no-device': 'This device is not set up for reminders. Click "Save time" to set it up again.',
    rejected:
        'The push service refused the server (code 401/403). The VAPID keys on the server do not match: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be a pair.',
    server: 'The test could not be sent. Wait a moment (the server may be waking up) and try again.',
};

type FormProps = Pick<Props, 'settings' | 'active' | 'onEnable' | 'onDisable' | 'onSendTest'>;

function ReminderForm({ settings, active, onEnable, onDisable, onSendTest }: FormProps) {
    const [time, setTime] = useState(settings.time);
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

    function handleEnable() {
        return run(async () => {
            const result = await onEnable(time);
            if (result === 'ok') {
                setMessage(`Reminder set for ${time} every day. Use "Send a test" to check it reaches you.`);
            } else {
                setProblem(ENABLE_PROBLEMS[result]);
            }
        });
    }

    function handleTest() {
        return run(async () => {
            setMessage('Sending a test and waiting for it to arrive…');
            const result = await onSendTest();
            if (result === 'shown') {
                setMessage(
                    'It works: the test notification arrived on this device. If you did not see it pop up, your system is hiding it (check Do Not Disturb and the notification settings for your browser).',
                );
            } else {
                setMessage('');
                setProblem(TEST_PROBLEMS[result]);
            }
        });
    }

    function handleDisable() {
        return run(async () => {
            if (await onDisable()) {
                setMessage('Reminders are off.');
            } else {
                setProblem('Could not turn off reminders. Check your connection and try again.');
            }
        });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label htmlFor="reminder-time" className="text-sm font-semibold">
                    Remind me at
                </label>
                <Input
                    id="reminder-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                />
            </div>

            <Button variant="sun" onClick={handleEnable} disabled={!time || working}>
                <BellRing aria-hidden="true" />
                {active ? 'Save time' : 'Turn on reminders'}
            </Button>

            {active && (
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleTest}
                        disabled={working}
                    >
                        Send a test
                    </Button>
                    <Button
                        variant="ghost"
                        className="flex-1"
                        onClick={handleDisable}
                        disabled={working}
                    >
                        Turn off
                    </Button>
                </div>
            )}

            {message && (
                <p role="status" className="text-sm font-medium">
                    {message}
                </p>
            )}
            {problem && <ErrorAlert>{problem}</ErrorAlert>}

            <p className="text-xs text-quiet">
                It can arrive a few minutes after the time you pick. Turn it on once on each
                device where you want it.
            </p>
        </div>
    );
}
