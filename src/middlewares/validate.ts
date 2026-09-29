import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

export function validate(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const message = result.error.issues
                .map((issue) => {
                    const path = issue.path.length ? issue.path.join('.') + ': ' : '';
                    return `${path}${issue.message}`;
                })
                .join('; ');

            throw new AppError(message, 400);
        }

        req.body = result.data;
        next();
    };
}
