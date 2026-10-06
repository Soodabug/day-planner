import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import { AppError } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const ONE_WEEK = 60 * 60 * 24 * 7;

export function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export function checkPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

export function createToken(userId: string) {
    const payload = {
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + ONE_WEEK,
    };
    return sign(payload, JWT_SECRET, 'HS256');
}

export type AuthEnv = {
    Variables: { userId: string };
};

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header('Authorization');

    if (!header || !header.startsWith('Bearer ')) {
        throw new AppError('UNAUTHORIZED');
    }

    const token = header.slice('Bearer '.length);

    try {
        const payload = await verify(token, JWT_SECRET, 'HS256');
        c.set('userId', payload.sub as string);
    } catch {
        throw new AppError('UNAUTHORIZED');
    }

    await next();
});