import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { and, eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { tasks as tasksTable, users as usersTable } from './db/schema.js';
import { authSchema, createTaskSchema, taskIdSchema } from './validation.js';
import { AppError, errors } from './errors.js';
import { checkPassword, createToken, hashPassword, requireUser, type AuthEnv } from './auth.js';
import { cors } from 'hono/cors';

const app = new Hono<AuthEnv>();
app.use(
    '*',
    cors({
        origin: process.env.WEB_ORIGIN!,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    }),
);

app.get('/', (c) => {
    return c.text('Day Planner API');
});

// ---------- auth ----------

app.post('/auth/signup', async (c) => {
    const parsed = authSchema.safeParse(await c.req.json());
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
    const parsed = authSchema.safeParse(await c.req.json());
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

    const parsed = createTaskSchema.safeParse(await c.req.json());
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

    const [task] = await db
        .update(tasksTable)
        .set({ done: true })
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