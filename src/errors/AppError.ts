import { errorMessage } from '../messages/errors.js';
import type { ErrorCode, ErrorMessageArgs } from '../messages/errors.js';

export class AppError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;

    constructor(...args: ErrorMessageArgs) {
        const { code, status, message } = errorMessage(...args);
        super(message);
        this.code = code;
        this.statusCode = status;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    static from(error: unknown, code: 'LOAD_TEST_FAILED'): AppError {
        if (error instanceof AppError) {
            return error;
        }
        const detail = (error instanceof Error ? error.message : String(error)) || 'sem detalhes';
        return new AppError(code, { detail });
    }
}
