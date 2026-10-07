import webpush from 'web-push';
import { and, eq, isNull, ne, or } from 'drizzle-orm';
import { db } from './db/client.js';
import { pushSubscriptions, reminderSettings, tasks as tasksTable } from './db/schema.js';

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

// Called by the cron endpoint every few minutes, and by the server itself
// every minute while it is awake.
// A user is due when their local time has reached their reminder time
// and they did not get today's reminder yet.
// force = ignore time and "already sent" (for local testing); it does not mark anything as sent.
export async function sendDueReminders(force = false) {
    const allEnabled = await db
        .select()
        .from(reminderSettings)
        .where(eq(reminderSettings.enabled, true));

    let due = 0;
    let sent = 0;
    let removed = 0;

    for (const settings of allEnabled) {
        const local = localDateAndTime(settings.timezone);
        const isDue = local.time >= settings.time && settings.lastSentDate !== local.date;
        if (!isDue && !force) continue;

        // Claim today's reminder before sending. If two runs overlap (cron and the
        // server's own timer), only the one that wins this update sends.
        if (!force) {
            const claimed = await db
                .update(reminderSettings)
                .set({ lastSentDate: local.date })
                .where(
                    and(
                        eq(reminderSettings.userId, settings.userId),
                        or(
                            isNull(reminderSettings.lastSentDate),
                            ne(reminderSettings.lastSentDate, local.date),
                        ),
                    ),
                )
                .returning({ userId: reminderSettings.userId });
            if (claimed.length === 0) continue;
        }
        due++;

        const tasks = await db
            .select()
            .from(tasksTable)
            .where(eq(tasksTable.userId, settings.userId));

        const result = await sendToUser(
            settings.userId,
            reminderText(tasks, local.date, settings.message),
        );
        sent += result.sent;
        removed += result.removed;

        // Done for today when a push went out, or when there is no device left to try.
        // If every send failed for another reason, give the claim back so the next run tries again.
        const finished = result.sent > 0 || result.devices === result.removed;
        if (!finished && !force) {
            await db
                .update(reminderSettings)
                .set({ lastSentDate: settings.lastSentDate })
                .where(eq(reminderSettings.userId, settings.userId));
        }
    }

    return { due, sent, removed };
}
