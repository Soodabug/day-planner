import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { pushSupported, type EnableResult, type ReminderSettings } from '../hooks/useReminder';
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
    onSendTest: () => Promise<boolean>;
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
                setMessage(`Reminder set for ${time} every day.`);
            } else if (result === 'blocked') {
                setProblem(
                    'Notifications are blocked. Allow them for this site in your browser settings, then try again.',
                );
            } else {
                setProblem('Could not turn on reminders. Check your connection and try again.');
            }
        });
    }

    function handleTest() {
        return run(async () => {
            if (await onSendTest()) {
                setMessage('Test sent. It should appear in a few seconds.');
            } else {
                setProblem('The test could not be sent. Turn reminders off and on again.');
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
