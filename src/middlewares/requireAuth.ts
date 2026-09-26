import { Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { verifyToken } from '../utils/verifyToken.js';
import type { AuthenticatedRequest } from './optionalAuth.js';

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const payload = verifyToken(req.headers.authorization);
    if (!payload) {
        throw new AppError('Authentication required', 401);
    }
    req.userId = payload.sub;
    next();
}
