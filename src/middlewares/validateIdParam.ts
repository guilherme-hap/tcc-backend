import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { idSchema } from '../schemas/shared.js';

type NotFoundCode = 'EVALUATION_NOT_FOUND' | 'SAVED_API_NOT_FOUND' | 'CUSTOM_RULE_NOT_FOUND';

export function validateIdParam(notFoundCode: NotFoundCode) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!idSchema.safeParse(req.params.id).success) {
            throw new AppError(notFoundCode);
        }
        next();
    };
}
