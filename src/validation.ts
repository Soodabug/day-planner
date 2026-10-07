import { z } from 'zod';

export const createTaskSchema = z.object({
    title: z.string().min(1),
    date: z.iso.date(),
});

// Every field is optional: send only what should change.
export const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    date: z.iso.date().optional(),
    done: z.boolean().optional(),
});

export const taskIdSchema = z.uuid();

export const authSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});