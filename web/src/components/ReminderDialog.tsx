import { useState } from 'react';
import { BellRing } from 'lucide-react';
import type { ReminderSettings } from '../hooks/useReminder';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

type Props = {
    open: boolean;
    onClose: () => void;
    settings: ReminderSettings;
    permission: NotificationPermission | 'unsupported';
    active: boolean;
    onEnable: (time: string) => Promise<boolean>;
    onDisable: () => void;
    onSendTest: () => boolean;
};

export function ReminderDialog({
    open,
    onClose,
    settings,
    permission,
    active,
    onEnable,
    onDisable,
    onSendTest,
}: Props) {
    const [time, setTime] = useState(settings.time);
    const [message, setMessage] = useState('');
    const [problem, setProblem] = useState('');

    async function handleEnable() {
        setMessage('');
        setProblem('');
        const ok = await onEnable(time);
        if (ok) {
            setMessage(`Reminder set for ${time} every day.`);
        } else {
            setProblem('Notifications are blocked. Allow them for this site in your browser settings, then try again.');
        }
    }

    function handleTest() {
        setMessage('');
        setProblem('');
        if (onSendTest()) {
            setMessage('Test sent. Check your notifications.');
        } else {
            setProblem('This browser could not show the notification.');
        }
    }

    function handleDisable() {
        setProblem('');
        onDisable();
        setMessage('Reminders are off.');
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Daily reminder"
            description="One notification a day with what is on your plan and what to start with."
        >
            {permission === 'unsupported' ? (
                <ErrorAlert>This browser does not support notifications.</ErrorAlert>
            ) : (
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

                    <Button variant="sun" onClick={handleEnable} disabled={!time}>
                        <BellRing aria-hidden="true" />
                        {active ? 'Save time' : 'Turn on reminders'}
                    </Button>

                    {active && (
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={handleTest}>
                                Send a test
                            </Button>
                            <Button variant="ghost" className="flex-1" onClick={handleDisable}>
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
                        Tasks with a time also notify you at that time. Notifications show up while Day Planner is open in a browser tab.
                    </p>
                </div>
            )}
        </Dialog>
    );
}
