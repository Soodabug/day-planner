export const errors = {
    VALIDATION_FAILED: { status: 400, message: 'Invalid request' },
    NOT_FOUND: { status: 404, message: 'Not found' },
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