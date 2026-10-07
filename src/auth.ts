import bcrypt from 'bcryptjs';
import { sign, verify } from 'hono/jwt';
import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { users } from './db/schema.js';
import { AppError } from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const ONE_WEEK = 60 * 60 * 24 * 7;

export function hashPassword(password: string) {
    return bcrypt.hash(password, 10);
}

export function checkPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
}

// tokenVersion = the user's current token_version. The token stops working when that changes.
export function createToken(userId: string, tokenVersion: number) {
    const payload = {
        sub: userId,
        ver: tokenVersion,
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

    let userId: string;
    let tokenVersion: number;
    try {
        const payload = await verify(token, JWT_SECRET, 'HS256');
        userId = payload.sub as string;
        // Tokens issued before versions existed count as version 0.
        tokenVersion = typeof payload.ver === 'number' ? payload.ver : 0;
    } catch {
        throw new AppError('UNAUTHORIZED');
    }

    // The account must still exist, and the token must not be older than
    // the last "log out everywhere" (a password reset).
    const [user] = await db
        .select({ tokenVersion: users.tokenVersion })
        .from(users)
        .where(eq(users.id, userId));
    if (!user || user.tokenVersion !== tokenVersion) {
        throw new AppError('UNAUTHORIZED');
    }

    c.set('userId', userId);

    await next();
});