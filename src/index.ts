import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from './db/client.js';
import {
    passwordResets,
    pushSubscriptions,
    reminderSettings,
    tasks as tasksTable,
    users as usersTable,
} from './db/schema.js';
import {
    authSchema,
    createTaskSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    pushSubscriptionSchema,
    pushUnsubscribeSchema,
    reminderSchema,
    taskIdSchema,
    updateTaskSchema,
} from './validation.js';
import { AppError, errors } from './errors.js';
import { checkPassword, createToken, hashPassword, requireUser, type AuthEnv } from './auth.js';
import { cors } from 'hono/cors';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { sendEmail } from './email.js';
import {
    localDateAndTime,
    reminderText,
    sendDueReminders,
    sendToUser,
    vapidPublicKey,
} from './push.js';

const app = new Hono<AuthEnv>();
app.use(
    '*',
    cors({
        origin: process.env.WEB_ORIGIN!,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    }),
);

// Reads the JSON body. A missing or malformed body is a client error (400), not a crash (500).
async function readJson(c: Context<AuthEnv>): Promise<unknown> {
    try {
        return await c.req.json();
    } catch {
        throw new AppError('VALIDATION_FAILED', 'body must be valid JSON');
    }
}

app.get('/', (c) => {
    return c.text('Day Planner API');
});

// ---------- auth ----------

app.post('/auth/signup', async (c) => {
    const parsed = authSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { email, password } = parsed.data;

    const [existing] = await db
        .select()
        .from(usersTable)
        // lower(): also finds accounts created with capital letters before emails were normalized
        .where(eq(sql`lower(${usersTable.email})`, email));
    if (existing) {
        throw new AppError('EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
        .insert(usersTable)
        .values({ email, passwordHash })
        .returning({ id: usersTable.id, email: usersTable.email });

    const token = await createToken(user.id, 0);
    return c.json({ token, user }, 201);
});

app.post('/auth/login', async (c) => {
    const parsed = authSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { email, password } = parsed.data;

    const [user] = await db
        .select()
        .from(usersTable)
        // lower(): also finds accounts created with capital letters before emails were normalized
        .where(eq(sql`lower(${usersTable.email})`, email));

    if (!user || !(await checkPassword(password, user.passwordHash))) {
        throw new AppError('INVALID_CREDENTIALS');
    }

    const token = await createToken(user.id, user.tokenVersion);
    return c.json({ token, user: { id: user.id, email: user.email } });
});

// ---------- password reset ----------

const RESET_LINK_MINUTES = 60;
const RESET_REQUEST_GAP_SECONDS = 60;

function hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}

// Step 1: the user asks for a reset link.
// The answer is the same whether the account exists or not,
// so this cannot be used to find out who has an account.
app.post('/auth/forgot-password', async (c) => {
    const parsed = forgotPasswordSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { email } = parsed.data;
    const answer = { message: 'If an account exists for this email, a reset link has been sent' };

    const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(sql`lower(${usersTable.email})`, email));
    if (!user) {
        return c.json(answer);
    }

    // At most one email per minute per account.
    const recently = new Date(Date.now() - RESET_REQUEST_GAP_SECONDS * 1000);
    const [recent] = await db
        .select({ id: passwordResets.id })
        .from(passwordResets)
        .where(and(eq(passwordResets.userId, user.id), gt(passwordResets.createdAt, recently)));
    if (recent) {
        return c.json(answer);
    }

    const token = randomBytes(32).toString('base64url');
    await db.insert(passwordResets).values({
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000),
    });

    const link = `${process.env.WEB_ORIGIN}/?reset=${token}`;
    await sendEmail({
        to: user.email,
        subject: 'Reset your Day Planner password',
        text:
            `Someone asked to reset the password for your Day Planner account.\n\n` +
            `Choose a new password here (the link works for ${RESET_LINK_MINUTES} minutes):\n${link}\n\n` +
            `If this was not you, ignore this email. Your password stays the same.`,
        html:
            `<p>Someone asked to reset the password for your Day Planner account.</p>` +
            `<p><a href="${link}">Choose a new password</a> (the link works for ${RESET_LINK_MINUTES} minutes).</p>` +
            `<p>If this was not you, ignore this email. Your password stays the same.</p>`,
    });

    return c.json(answer);
});

// Step 2: the user opens the link and chooses a new password. Logs them in.
app.post('/auth/reset-password', async (c) => {
    const parsed = resetPasswordSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { token, password } = parsed.data;

    // Claim the link in one step, so it cannot be used twice.
    const [reset] = await db
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(
            and(
                eq(passwordResets.tokenHash, hashResetToken(token)),
                isNull(passwordResets.usedAt),
                gt(passwordResets.expiresAt, new Date()),
            ),
        )
        .returning();
    if (!reset) {
        throw new AppError('RESET_LINK_INVALID');
    }

    // Raising token_version logs the account out on every device:
    // all login tokens issued before now stop working.
    const passwordHash = await hashPassword(password);
    const [updated] = await db
        .update(usersTable)
        .set({ passwordHash, tokenVersion: sql`${usersTable.tokenVersion} + 1` })
        .where(eq(usersTable.id, reset.userId))
        .returning({
            id: usersTable.id,
            email: usersTable.email,
            tokenVersion: usersTable.tokenVersion,
        });
    const user = { id: updated.id, email: updated.email };

    // Logged-out devices must not keep receiving this account's reminders.
    // Reminders are turned on again per device after logging in.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, reset.userId));

    // Any other reset links of this account stop working too.
    await db
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResets.userId, reset.userId), isNull(passwordResets.usedAt)));

    const loginToken = await createToken(user.id, updated.tokenVersion);
    return c.json({ token: loginToken, user });
});

// ---------- tasks (all need a token) ----------

app.get('/tasks', requireUser, async (c) => {
    const userId = c.get('userId');

    const result = await db
        .select()
        .from(tasksTable)
        .where(eq(tasksTable.userId, userId));

    return c.json(result);
});

app.post('/tasks', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsed = createTaskSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }

    const [newTask] = await db
        .insert(tasksTable)
        .values({ ...parsed.data, userId })
        .returning();

    return c.json(newTask, 201);
});

app.put('/tasks/:id', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsedId = taskIdSchema.safeParse(c.req.param('id'));
    if (!parsedId.success) {
        throw new AppError('VALIDATION_FAILED', 'id must be a uuid');
    }

    // The body is optional. Without one (or with an empty one) the task is marked as done.
    const rawBody = await c.req.text();
    let body: unknown = {};
    if (rawBody.trim() !== '') {
        try {
            body = JSON.parse(rawBody);
        } catch {
            throw new AppError('VALIDATION_FAILED', 'body must be valid JSON');
        }
    }

    const parsed = updateTaskSchema.safeParse(body);
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }

    const { title, date, done } = parsed.data;
    const nothingSent = title === undefined && date === undefined && done === undefined;
    const changes = nothingSent ? { done: true } : { title, date, done };

    const [task] = await db
        .update(tasksTable)
        .set(changes)
        .where(and(eq(tasksTable.id, parsedId.data), eq(tasksTable.userId, userId)))
        .returning();

    if (!task) {
        throw new AppError('NOT_FOUND');
    }

    return c.json(task);
});

app.delete('/tasks/:id', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsedId = taskIdSchema.safeParse(c.req.param('id'));
    if (!parsedId.success) {
        throw new AppError('VALIDATION_FAILED', 'id must be a uuid');
    }

    const [task] = await db
        .delete(tasksTable)
        .where(and(eq(tasksTable.id, parsedId.data), eq(tasksTable.userId, userId)))
        .returning();

    if (!task) {
        throw new AppError('NOT_FOUND');
    }

    return c.json({ message: 'Task deleted successfully' });
});

// ---------- reminders (web push) ----------

// The browser needs this key to create a push subscription. It is public by design.
app.get('/push/public-key', (c) => {
    return c.json({ publicKey: vapidPublicKey });
});

// Save this browser/device for the logged-in user.
app.post('/push/subscriptions', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsed = pushSubscriptionSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { endpoint, keys } = parsed.data;

    // The same browser can be re-used by another account: the latest login owns it.
    await db
        .insert(pushSubscriptions)
        .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .onConflictDoUpdate({
            target: pushSubscriptions.endpoint,
            set: { userId, p256dh: keys.p256dh, auth: keys.auth },
        });

    return c.json({ message: 'Subscription saved' }, 201);
});

app.delete('/push/subscriptions', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsed = pushUnsubscribeSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }

    await db
        .delete(pushSubscriptions)
        .where(
            and(
                eq(pushSubscriptions.endpoint, parsed.data.endpoint),
                eq(pushSubscriptions.userId, userId),
            ),
        );

    return c.json({ message: 'Subscription removed' });
});

app.get('/reminder', requireUser, async (c) => {
    const userId = c.get('userId');

    const [settings] = await db
        .select()
        .from(reminderSettings)
        .where(eq(reminderSettings.userId, userId));

    if (!settings) {
        return c.json({ enabled: false, time: '09:00', timezone: null, message: '', nextDate: null });
    }

    return c.json({
        enabled: settings.enabled,
        time: settings.time,
        timezone: settings.timezone,
        message: settings.message ?? '',
        nextDate: nextReminderDate(settings),
    });
});

// The user's local date (YYYY-MM-DD) of their next reminder, or null when reminders are off.
function nextReminderDate(settings: {
    enabled: boolean;
    timezone: string;
    lastSentDate: string | null;
}) {
    if (!settings.enabled) return null;

    const today = localDateAndTime(settings.timezone).date;
    if (settings.lastSentDate !== today) return today;

    // Today's reminder is done (or its time had passed when it was set): tomorrow.
    const tomorrow = new Date(`${today}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
}

app.put('/reminder', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsed = reminderSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { enabled, time, timezone } = parsed.data;
    const message = parsed.data.message || null;

    // If today's time is already behind us, start tomorrow instead of sending right away.
    const local = localDateAndTime(timezone);
    const lastSentDate = local.time > time ? local.date : null;

    await db
        .insert(reminderSettings)
        .values({ userId, enabled, time, timezone, message, lastSentDate })
        .onConflictDoUpdate({
            target: reminderSettings.userId,
            set: { enabled, time, timezone, message, lastSentDate },
        });

    return c.json({
        enabled,
        time,
        timezone,
        message: message ?? '',
        nextDate: nextReminderDate({ enabled, timezone, lastSentDate }),
    });
});

// Sends the user's reminder to their own devices right now,
// exactly as the daily one will look. Does not count as today's reminder.
app.post('/push/test', requireUser, async (c) => {
    const userId = c.get('userId');

    const [settings] = await db
        .select()
        .from(reminderSettings)
        .where(eq(reminderSettings.userId, userId));
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.userId, userId));
    const today = localDateAndTime(settings?.timezone ?? 'UTC').date;

    const result = await sendToUser(userId, reminderText(tasks, today, settings?.message));

    return c.json(result);
});

// ---------- jobs (called by a cron service, not by the app) ----------

function hasCronSecret(c: Context<AuthEnv>) {
    const expected = process.env.CRON_SECRET;
    const given = c.req.header('X-Cron-Secret');
    if (!expected || !given) return false;

    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

// Sends the daily reminder to every user who is due.
// Safe to call as often as you like: each user gets at most one per day.
app.post('/jobs/send-reminders', async (c) => {
    if (!hasCronSecret(c)) {
        throw new AppError('UNAUTHORIZED');
    }

    // ?force=1 ignores the time of day and "already sent today". For testing only.
    const force = c.req.query('force') === '1';
    const result = await sendDueReminders(force);

    return c.json(result);
});

// ---------- errors ----------

app.onError((err, c) => {
    const requestId = crypto.randomUUID();

    if (err instanceof AppError) {
        const { status, message } = errors[err.code];
        return c.json(
            { error: { code: err.code, message, details: err.details, requestId } },
            status,
        );
    }

    console.error(err);
    return c.json(
        { error: { code: 'INTERNAL', message: errors.INTERNAL.message, requestId } },
        500,
    );
});

// While the server is awake it checks for due reminders every minute by itself.
// The external cron call is still needed: it wakes a sleeping server.
const REMINDER_CHECK_MS = 60_000;
setInterval(() => {
    sendDueReminders().catch((err) => console.error('reminder check failed', err));
}, REMINDER_CHECK_MS);

// Hosting providers tell us which port to use through PORT; locally it is 3000.
const port = Number(process.env.PORT) || 3000;

serve({ fetch: app.fetch, port }, () => {
    console.log(`Hono server started on port ${port}`);
});