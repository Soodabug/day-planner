import webpush from 'web-push';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from './db/client.js';
import { pushSubscriptions, reminders, tasks as tasksTable } from './db/schema.js';

export const vapidPublicKey = process.env.VAPID_PUBLIC_KEY!;

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    vapidPublicKey,
    process.env.VAPID_PRIVATE_KEY!,
);

type PushMessage = {
    title: string;
    body: string;
};

type TaskForReminder = {
    title: string;
    date: string;
    done: boolean;
};

// The date (YYYY-MM-DD) and time (HH:MM) it is right now in a timezone.
export function localDateAndTime(timezone: string, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)!.value;

    return {
        date: `${get('year')}-${get('month')}-${get('day')}`,
        time: `${get('hour')}:${get('minute')}`,
    };
}

// The notification for one user.
// With a message of their own, that is the headline and the plan goes below it.
export function reminderText(
    tasks: TaskForReminder[],
    today: string,
    message?: string | null,
): PushMessage {
    const plan = planSummary(tasks, today);
    if (!message) return plan;

    // "Your plan: 2 for today. Start with ..." / "What is the plan today? Nothing planned yet..."
    const joiner = /[.?!]$/.test(plan.title) ? ' ' : '. ';
    return { title: message, body: plan.title + joiner + plan.body };
}

// Same rules as the app: overdue = not done AND date before today.
function planSummary(tasks: TaskForReminder[], today: string): PushMessage {
    const open = tasks
        .filter((t) => !t.done)
        .sort((a, b) => a.date.localeCompare(b.date));
    const dueToday = open.filter((t) => t.date === today);
    const overdue = open.filter((t) => t.date < today);

    if (dueToday.length === 0 && overdue.length === 0) {
        return {
            title: 'What is the plan today?',
            body: 'Nothing planned yet. Write down one thing you want to get done.',
        };
    }

    const parts: string[] = [];
    if (dueToday.length > 0) parts.push(`${dueToday.length} for today`);
    if (overdue.length > 0) parts.push(`${overdue.length} overdue`);

    const first = [...overdue, ...dueToday][0];
    return {
        title: `Your plan: ${parts.join(', ')}`,
        body: `Start with "${first.title}".`,
    };
}

// Sends one message to every device of a user.
// Devices the push service no longer knows (404/410) are deleted.
export async function sendToUser(userId: string, message: PushMessage) {
    const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

    let sent = 0;
    let removed = 0;
    // HTTP status the push service answered for each failed send (0 = no answer at all).
    const failures: number[] = [];

    for (const subscription of subscriptions) {
        try {
            await webpush.sendNotification(
                {
                    endpoint: subscription.endpoint,
                    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
                },
                JSON.stringify(message),
            );
            sent++;
        } catch (err) {
            const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined;

            if (statusCode === 404 || statusCode === 410) {
                await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
                removed++;
            } else {
                failures.push(statusCode ?? 0);
                console.error('push failed', statusCode ?? err);
            }
        }
    }

    return { devices: subscriptions.length, sent, removed, failures };
}

type Reminder = typeof reminders.$inferSelect;

// What should happen to a reminder right now?
//   'send'    its time has come
//   'expired' a one-time reminder whose day went by while the server could not send it
//   'wait'    not yet (or today's daily one is done)
export function reminderState(
    reminder: Pick<Reminder, 'date' | 'time' | 'repeatDaily' | 'lastSentDate'>,
    local: { date: string; time: string },
): 'send' | 'expired' | 'wait' {
    if (reminder.repeatDaily) {
        if (local.date < reminder.date) return 'wait';
        if (reminder.lastSentDate === local.date) return 'wait';
        return local.time >= reminder.time ? 'send' : 'wait';
    }

    if (local.date < reminder.date) return 'wait';
    if (local.date > reminder.date) return 'expired';
    return local.time >= reminder.time ? 'send' : 'wait';
}

// Called by the cron endpoint every few minutes, and by the server itself
// every minute while it is awake. Sends every reminder whose time has come.
// force = send all reminders now (for local testing); nothing is marked or deleted.
export async function sendDueReminders(force = false) {
    const all = await db.select().from(reminders);

    let due = 0;
    let sent = 0;
    let removed = 0;

    for (const reminder of all) {
        const local = localDateAndTime(reminder.timezone);
        const state = force ? 'send' : reminderState(reminder, local);

        if (state === 'wait') continue;

        if (state === 'expired') {
            await db.delete(reminders).where(eq(reminders.id, reminder.id));
            continue;
        }

        // Claim it before sending. If two runs overlap (cron and the server's own
        // timer), only the one that wins this update sends.
        if (!force) {
            const claimed = await db
                .update(reminders)
                .set({ lastSentDate: local.date })
                .where(
                    and(
                        eq(reminders.id, reminder.id),
                        or(isNull(reminders.lastSentDate), ne(reminders.lastSentDate, local.date)),
                    ),
                )
                .returning({ id: reminders.id });
            if (claimed.length === 0) continue;
        }
        due++;

        const tasks = await db
            .select()
            .from(tasksTable)
            .where(eq(tasksTable.userId, reminder.userId));

        const result = await sendToUser(
            reminder.userId,
            reminderText(tasks, local.date, reminder.text),
        );
        sent += result.sent;
        removed += result.removed;
        if (force) continue;

        // Done when a push went out, or when there is no device left to try.
        const finished = result.sent > 0 || result.devices === result.removed;

        if (!finished) {
            // Every send failed for another reason: give the claim back so the next run tries again.
            await db
                .update(reminders)
                .set({ lastSentDate: reminder.lastSentDate })
                .where(eq(reminders.id, reminder.id));
        } else if (!reminder.repeatDaily) {
            // A one-time reminder has done its job.
            await db.delete(reminders).where(eq(reminders.id, reminder.id));
        }
    }

    return { due, sent, removed };
}
