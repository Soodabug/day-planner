import { z } from 'zod';

export const createTaskSchema = z.object({
    title: z.string().min(1),
    date: z.iso.date(),
});

// Every field is optional: send only what should change.
export const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    date: z.iso.date().optional(),
    done: z.boolean().optional(),
});

// What the browser's PushSubscription.toJSON() gives us.
export const pushSubscriptionSchema = z.object({
    endpoint: z.url(),
    keys: z.object({
        p256dh: z.string().min(1),
        auth: z.string().min(1),
    }),
});

export const pushUnsubscribeSchema = z.object({
    endpoint: z.url(),
});

function isTimezone(value: string) {
    try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

export const reminderSchema = z.object({
    enabled: z.boolean(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), // HH:MM, 24h
    timezone: z.string().refine(isTimezone, 'must be an IANA timezone like Europe/Rome'),
});

export const taskIdSchema = z.uuid();

export const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
});

export const authSchema = z.object({
    // Emails are not case sensitive: " Name@Mail.com " and "name@mail.com" are the same account.
    email: z.string().trim().toLowerCase().pipe(z.email()),
    password: z.string().min(8),
});