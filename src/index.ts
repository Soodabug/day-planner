import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { db } from './db/client.js';
import { tasks as tasksTable } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { createTaskSchema, taskIdSchema } from './validation.js';
import { AppError, errors } from './errors.js';

const app = new Hono();
////////////////////////////
app.post('/tasks', async (c) => {
    const body = await c.req.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
        throw new AppError('VALIDATION_FAILED', parsed.error.issues);
    }

    const [newTask] = await db
        .insert(tasksTable)
        .values(parsed.data)
        .returning();

    return c.json(newTask, 201);
});
////////////////////////////////////////
app.get('/', (c) => {
    return c.text('Hello00000');
});

app.get('/tasks', async (c) => {
    const result = await db.select().from(tasksTable);
    return c.json(result);
});
/////////////////////////////////
app.put('/tasks/:id', async (c) => {
    const parsedId = taskIdSchema.safeParse(c.req.param('id'));
    if (!parsedId.success) {
        throw new AppError('VALIDATION_FAILED', 'id must be a uuid');
    }
    const id = parsedId.data;
    const [task] = await db
        .update(tasksTable)
        .set({ done: true })
        .where(eq(tasksTable.id, id))
        .returning();

    if (!task) {
        throw new AppError('NOT_FOUND');
    }

    return c.json(task);
});
/////////////////////////////
app.delete('/tasks/:id', async (c) => {
    const id = c.req.param('id');

    const [task] = await db
        .delete(tasksTable)
        .where(eq(tasksTable.id, id))
        .returning();

    if (!task) {
        return c.text('Task Not Found', 404);
    }

    return c.json({ message: 'Task deleted successfully' });
});
///////////////////////
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
/////////////////////////////
serve({ fetch: app.fetch, port: 3000 }, () => {
    console.log('Hono server started');
});