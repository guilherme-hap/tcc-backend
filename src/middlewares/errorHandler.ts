import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { ValidationError } from '../errors/ValidationError.js';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    if (!(err instanceof AppError)) {
        console.error('Unhandled internal server error:', err);
    }

    const error = err instanceof AppError ? err : new AppError('INTERNAL_ERROR');

    res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        ...(error instanceof ValidationError && { issues: error.issues }),
    });
}
