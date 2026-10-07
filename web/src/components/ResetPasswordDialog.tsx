import { useState, type FormEvent } from 'react';
import { api, ApiError, saveToken } from '../api';
import { moveLocalTasksToAccount } from '../localTasks';
import { ErrorAlert } from './ui/alert';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Input } from './ui/input';

type Props = {
    // The token from the emailed link (?reset=...). null = dialog closed.
    token: string | null;
    onClose: () => void;
    onLoggedIn: () => void;
    onRequestNewLink: () => void;
};

// Opens when the user arrives through a "forgot password" link.
export function ResetPasswordDialog({ token, onClose, onLoggedIn, onRequestNewLink }: Props) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [linkDead, setLinkDead] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!token) return;
        setError('');
        setLoading(true);

        try {
            const result = await api.resetPassword(token, password);
            saveToken(result.token);

            try {
                await moveLocalTasksToAccount();
            } catch {
                // Signed in fine. Tasks that did not make it stay in this browser.
            }

            setPassword('');
            onLoggedIn();
        } catch (err) {
            if (err instanceof ApiError && err.code === 'RESET_LINK_INVALID') {
                setLinkDead(true);
                setError('This reset link has expired or was already used.');
            } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
                setError('Choose a password with at least 8 characters.');
            } else if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError('Could not reach the server.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog
            open={token !== null}
            onClose={onClose}
            title="Choose a new password"
            description="After saving you are logged in with the new password."
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="new-password" className="text-sm font-semibold">
                        New password
                    </label>
                    <Input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        aria-invalid={error ? true : undefined}
                        aria-describedby="new-password-hint"
                        required
                    />
                    <p id="new-password-hint" className="text-xs text-quiet">
                        At least 8 characters.
                    </p>
                </div>

                {error && <ErrorAlert>{error}</ErrorAlert>}

                {linkDead ? (
                    <Button variant="sun" className="w-full" onClick={onRequestNewLink}>
                        Get a new link
                    </Button>
                ) : (
                    <Button type="submit" variant="sun" disabled={loading} className="w-full">
                        {loading ? 'Please wait…' : 'Save new password'}
                    </Button>
                )}
            </form>
        </Dialog>
    );
}
