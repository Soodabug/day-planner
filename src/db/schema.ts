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

// The daily reminder of one user. It is a user setting, not part of a task.
export const reminderSettings = pgTable('reminder_settings', {
    userId: uuid('user_id')
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    time: text('time').notNull(), // HH:MM (24h) in the user's timezone
    timezone: text('timezone').notNull(), // IANA name, e.g. Europe/Rome
    // Optional text the user wrote for their reminder. null = none.
    message: text('message'),
    // The user's local date of the last reminder, so each day gets only one.
    lastSentDate: date('last_sent_date'),
});