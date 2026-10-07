import { pgTable, uuid, text, date, boolean, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    date: date('date').notNull(),
    done: boolean('done').notNull().default(false),
});

// One row per browser/device that agreed to receive push notifications.
export const pushSubscriptions = pgTable('push_subscriptions', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
});

// The daily reminder of one user. It is a user setting, not part of a task.
export const reminderSettings = pgTable('reminder_settings', {
    userId: uuid('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    time: text('time').notNull(), // HH:MM (24h) in the user's timezone
    timezone: text('timezone').notNull(), // IANA name, e.g. Europe/Rome
    // The user's local date of the last reminder, so each day gets only one.
    lastSentDate: date('last_sent_date'),
});