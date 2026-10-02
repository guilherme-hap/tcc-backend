import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { parseOrThrow } from '../utils/parseOrThrow.js';

export function validate(schema: ZodType) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        req.body = parseOrThrow(schema, req.body);
        next();
    };
}
