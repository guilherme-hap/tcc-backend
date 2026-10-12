import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { ValidationError } from '../errors/ValidationError.js';

function toAppError(err: unknown): AppError {
    if (err instanceof AppError) {
        return err;
    }

    const { type, status, statusCode } = (err ?? {}) as { type?: unknown; status?: unknown; statusCode?: unknown };
    if (type === 'entity.parse.failed') {
        return new AppError('REQUEST_BODY_MALFORMED');
    }
    if (type === 'entity.too.large') {
        return new AppError('REQUEST_BODY_TOO_LARGE');
    }

    const httpStatus = status ?? statusCode;
    if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
        return new AppError('REQUEST_INVALID');
    }

    console.error('Unhandled internal server error:', err);
    return new AppError('INTERNAL_ERROR');
}

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const error = toAppError(err);

    res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        ...(error instanceof ValidationError && { issues: error.issues }),
    });
}
