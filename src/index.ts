import { Hono, type Context } from 'hono';
import { serve } from '@hono/node-server';
import { and, eq } from 'drizzle-orm';
import { db } from './db/client.js';
import {
    pushSubscriptions,
    reminderSettings,
    tasks as tasksTable,
    users as usersTable,
} from './db/schema.js';
import {
    authSchema,
    createTaskSchema,
    pushSubscriptionSchema,
    pushUnsubscribeSchema,
    reminderSchema,
    taskIdSchema,
    updateTaskSchema,
} from './validation.js';
import { AppError, errors } from './errors.js';
import { checkPassword, createToken, hashPassword, requireUser, type AuthEnv } from './auth.js';
import { cors } from 'hono/cors';
import { timingSafeEqual } from 'node:crypto';
import { localDateAndTime, sendDueReminders, sendToUser, vapidPublicKey } from './push.js';

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
        .where(eq(usersTable.email, email));
    if (existing) {
        throw new AppError('EMAIL_TAKEN');
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
        .insert(usersTable)
        .values({ email, passwordHash })
        .returning({ id: usersTable.id, email: usersTable.email });

    const token = await createToken(user.id);
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
        .where(eq(usersTable.email, email));

    if (!user || !(await checkPassword(password, user.passwordHash))) {
        throw new AppError('INVALID_CREDENTIALS');
    }

    const token = await createToken(user.id);
    return c.json({ token, user: { id: user.id, email: user.email } });
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
        return c.json({ enabled: false, time: '09:00', timezone: null });
    }

    return c.json({
        enabled: settings.enabled,
        time: settings.time,
        timezone: settings.timezone,
    });
});

app.put('/reminder', requireUser, async (c) => {
    const userId = c.get('userId');

    const parsed = reminderSchema.safeParse(await readJson(c));
    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }
    const { enabled, time, timezone } = parsed.data;

    // If today's time is already behind us, start tomorrow instead of sending right away.
    const local = localDateAndTime(timezone);
    const lastSentDate = local.time >= time ? local.date : null;

    await db
        .insert(reminderSettings)
        .values({ userId, enabled, time, timezone, lastSentDate })
        .onConflictDoUpdate({
            target: reminderSettings.userId,
            set: { enabled, time, timezone, lastSentDate },
        });

    return c.json({ enabled, time, timezone });
});

// Sends a test notification to the logged-in user's own devices, right now.
app.post('/push/test', requireUser, async (c) => {
    const userId = c.get('userId');

    const result = await sendToUser(userId, {
        title: 'Day Planner reminders work',
        body: 'This is what your daily reminder will look like.',
    });

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

serve({ fetch: app.fetch, port: 3000 }, () => {
    console.log('Hono server started');
});