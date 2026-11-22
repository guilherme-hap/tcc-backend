import { Response, NextFunction } from 'express';
import { isPublicDeployment } from '../config/publicDeployment.js';
import { AppError } from '../errors/AppError.js';
import { verifyToken } from '../utils/verifyToken.js';
import type { AuthenticatedRequest } from './optionalAuth.js';

export async function loadTestAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const payload = await verifyToken(req.headers.authorization);
    if (payload) {
        req.userId = payload.sub;
    }
    if (isPublicDeployment() && !req.userId) {
        throw new AppError('LOAD_TEST_AUTH_REQUIRED');
    }
    next();
}
