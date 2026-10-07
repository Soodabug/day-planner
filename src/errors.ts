export const errors = {
    VALIDATION_FAILED: { status: 400, message: 'Invalid request' },
    UNAUTHORIZED: { status: 401, message: 'You need to log in' },
    INVALID_CREDENTIALS: { status: 401, message: 'Wrong email or password' },
    REMINDER_IN_PAST: { status: 400, message: 'Pick a date and time that has not passed yet' },
    TOO_MANY_REMINDERS: { status: 400, message: 'You have reached the limit of reminders' },
    NOT_FOUND: { status: 404, message: 'Not found' },
    RESET_LINK_INVALID: { status: 400, message: 'This reset link is invalid or has expired' },
    EMAIL_TAKEN: { status: 409, message: 'This email is already registered' },
    INTERNAL: { status: 500, message: 'Something went wrong' },
} as const;

export type ErrorCode = keyof typeof errors;

export class AppError extends Error {
    code: ErrorCode;
    details?: unknown;

    constructor(code: ErrorCode, details?: unknown) {
        super(errors[code].message);
        this.code = code;
        this.details = details;
    }
}