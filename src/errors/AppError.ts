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
}
