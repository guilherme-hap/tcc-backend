import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/verifyToken.js';

export interface AuthenticatedRequest extends Request {
    userId?: string;
}

export async function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    const payload = await verifyToken(req.headers.authorization);
    if (payload) {
        req.userId = payload.sub;
    }
    next();
}
