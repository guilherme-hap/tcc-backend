import { Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { verifyToken } from '../utils/verifyToken.js';
import type { AuthenticatedRequest } from './optionalAuth.js';

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const payload = await verifyToken(req.headers.authorization);
    if (!payload) {
        throw new AppError('AUTH_REQUIRED');
    }
    req.userId = payload.sub;
    next();
}
