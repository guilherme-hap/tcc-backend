import { Response, NextFunction } from 'express';
import { isPublicDeployment } from '../config/publicDeployment.js';
import { AppError } from '../errors/AppError.js';
import { optionalAuth, type AuthenticatedRequest } from './optionalAuth.js';

export function loadTestAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    optionalAuth(req, res, () => {
        if (isPublicDeployment() && !req.userId) {
            throw new AppError('LOAD_TEST_AUTH_REQUIRED');
        }
        next();
    });
}
