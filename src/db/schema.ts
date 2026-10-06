import { pgTable, uuid, text, date, boolean } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    date: date('date').notNull(),
    done: boolean('done').notNull().default(false),
});