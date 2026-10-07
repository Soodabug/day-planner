import { useState, type FormEvent } from 'react';
import { api, ApiError, saveToken } from '../api';
import { moveLocalTasksToAccount } from '../localTasks';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

type Props = {
    open: boolean;
    onClose: () => void;
    onLoggedIn: () => void;
};

type Mode = 'login' | 'signup' | 'forgot';

const TITLES: Record<Mode, string> = {
    login: 'Log in',
    signup: 'Create an account',
    forgot: 'Reset your password',
};

export function AuthDialog({ open, onClose, onLoggedIn }: Props) {
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);

    function showError(err: unknown) {
        if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
            setError(
                mode === 'forgot'
                    ? 'Enter a valid email address.'
                    : 'Enter a valid email and a password with at least 8 characters.',
            );
        } else if (err instanceof ApiError) {
            setError(err.message);
        } else {
            setError('Could not reach the server.');
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setNotice('');
        setLoading(true);

        try {
            if (mode === 'forgot') {
                await api.forgotPassword(email);
                setNotice(
                    'If an account exists for this email, a reset link is on its way. It works for 1 hour. Check your spam folder too.',
                );
                return;
            }

            const result =
                mode === 'login'
                    ? await api.login(email, password)
                    : await api.signup(email, password);

            saveToken(result.token);

            try {
                await moveLocalTasksToAccount();
            } catch {
                // Signed in fine. Tasks that did not make it stay in this browser.
            }

            setPassword('');
            onLoggedIn();
        } catch (err) {
            showError(err);
        } finally {
            setLoading(false);
        }
    }

    function switchMode(next: Mode) {
        setMode(next);
        setError('');
        setNotice('');
    }

    const submitLabel = { login: 'Log in', signup: 'Sign up', forgot: 'Send reset link' }[mode];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={TITLES[mode]}
            description={
                mode === 'forgot'
                    ? 'Enter the email of your account and we send you a link to choose a new password.'
                    : 'Keep your plan on every device. Tasks you already wrote here come with you.'
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="email" className="text-sm font-semibold">
                        Email
                    </label>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={error ? true : undefined}
                        required
                    />
                </div>

                {mode !== 'forgot' && (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between">
                            <label htmlFor="password" className="text-sm font-semibold">
                                Password
                            </label>
                            {mode === 'login' && (
                                <Button
                                    variant="link"
                                    className="text-xs font-medium"
                                    onClick={() => switchMode('forgot')}
                                >
                                    Forgot password?
                                </Button>
                            )}
                        </div>
                        <Input
                            id="password"
                            type="password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={8}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
                            required
                        />
                        {mode === 'signup' && (
                            <p id="password-hint" className="text-xs text-quiet">
                                At least 8 characters.
                            </p>
                        )}
                    </div>
                )}

                {error && <ErrorAlert>{error}</ErrorAlert>}
                {notice && (
                    <p role="status" className="rounded-md border-2 border-ink bg-haze px-3 py-2.5 text-sm font-medium">
                        {notice}
                    </p>
                )}

                <Button type="submit" variant="sun" disabled={loading} className="w-full">
                    {loading ? 'Please wait…' : submitLabel}
                </Button>
            </form>

            <p className="mt-5 flex items-baseline justify-center gap-1.5 text-sm text-quiet">
                {mode === 'login' && 'No account?'}
                {mode === 'signup' && 'Already have an account?'}
                {mode === 'forgot' && 'Remembered it?'}
                <Button
                    variant="link"
                    onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                >
                    {mode === 'login' ? 'Sign up' : 'Log in'}
                </Button>
            </p>
        </Dialog>
    );
}
