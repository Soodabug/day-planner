import { z } from 'zod';

export const createTaskSchema = z.object({
    title: z.string().min(1),
    date: z.iso.date(),
});

export const taskIdSchema = z.uuid();

export const authSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});