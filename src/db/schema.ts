import { pgTable, uuid, text, date, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    // Login tokens carry this number. Raising it logs the user out on every device.
    tokenVersion: integer('token_version').notNull().default(0),
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

// A "forgot password" request. Only a hash of the emailed token is stored,
// so someone who can read the database still cannot reset a password.
export const passwordResets = pgTable('password_resets', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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

// A reminder the user wrote: a text that is pushed to their devices at a date and time.
// It is separate from tasks (tasks only have a date).
export const reminders = pgTable('reminders', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    // The day it fires. For a daily reminder: the first day.
    date: date('date').notNull(),
    time: text('time').notNull(), // HH:MM (24h) in the reminder's timezone
    timezone: text('timezone').notNull(), // IANA name, e.g. Europe/Rome
    // false = fires once on its date, then it is deleted. true = fires every day.
    repeatDaily: boolean('repeat_daily').notNull().default(false),
    // The local date it last fired, so a daily reminder fires once per day.
    lastSentDate: date('last_sent_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
