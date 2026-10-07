import { useState, type FormEvent } from 'react';
import { CalendarCheck } from 'lucide-react';
import { api, ApiError, saveToken } from './api';
import { ErrorAlert } from './components/ui/alert';
import { Button } from './components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

type Props = {
    onLoggedIn: () => void;
};

export function LoginPage({ onLoggedIn }: Props) {
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
        <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
            <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <CalendarCheck className="size-5" aria-hidden="true" />
                Day Planner
            </h1>

            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>{isLogin ? 'Log in' : 'Create an account'}</CardTitle>
                    <CardDescription>
                        {isLogin
                            ? 'Enter your email and password to see your tasks.'
                            : 'Sign up with your email to start planning your days.'}
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
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

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Password</Label>
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
                                <p id="password-hint" className="text-xs text-muted-foreground">
                                    At least 8 characters.
                                </p>
                            )}
                        </div>

                        {error && <ErrorAlert>{error}</ErrorAlert>}

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
                    {isLogin ? 'No account?' : 'Already have an account?'}
                    <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0"
                        onClick={switchMode}
                    >
                        {isLogin ? 'Sign up' : 'Log in'}
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
