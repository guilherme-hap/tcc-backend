import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { idSchema } from '../schemas/shared.js';

export function validateIdParam(notFoundMessage: string) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!idSchema.safeParse(req.params.id).success) {
            throw new AppError(notFoundMessage, 404);
        }
        next();
    };
}
