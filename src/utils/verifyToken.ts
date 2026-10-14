import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { jwtSecret } from './jwtSecret.js';

export interface TokenPayload {
    sub: string;
    [key: string]: unknown;
}

export function verifyToken(authHeader: string | undefined): TokenPayload | null {
    if (!authHeader) return null;

    if (!authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
        throw new AppError('AUTH_INVALID_TOKEN');
    }

    const token = authHeader.slice(7);
    const secret = jwtSecret();

    try {
        return jwt.verify(token, secret) as TokenPayload;
    } catch {
        throw new AppError('AUTH_INVALID_TOKEN');
    }
}
