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

export function AuthDialog({ open, onClose, onLoggedIn }: Props) {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
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
            if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
                setError('Enter a valid email and a password with at least 8 characters.');
            } else if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('Could not reach the server.');
            }
        } finally {
            setLoading(false);
        }
    }

    function switchMode() {
        setMode(mode === 'login' ? 'signup' : 'login');
        setError('');
    }

    const isLogin = mode === 'login';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={isLogin ? 'Log in' : 'Create an account'}
            description="Keep your plan on every device. Tasks you already wrote here come with you."
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

                <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-semibold">
                        Password
                    </label>
                    <Input
                        id="password"
                        type="password"
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={isLogin ? undefined : 'password-hint'}
                        required
                    />
                    {!isLogin && (
                        <p id="password-hint" className="text-xs text-quiet">
                            At least 8 characters.
                        </p>
                    )}
                </div>

                {error && <ErrorAlert>{error}</ErrorAlert>}

                <Button type="submit" variant="sun" disabled={loading} className="w-full">
                    {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
                </Button>
            </form>

            <p className="mt-5 flex justify-center gap-1.5 text-sm text-quiet">
                {isLogin ? 'No account?' : 'Already have an account?'}
                <Button variant="link" onClick={switchMode}>
                    {isLogin ? 'Sign up' : 'Log in'}
                </Button>
            </p>
        </Dialog>
    );
}
