import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';

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

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('FATAL: JWT_SECRET environment variable is not configured');
        throw new AppError('INTERNAL_ERROR');
    }

    try {
        return jwt.verify(token, secret) as TokenPayload;
    } catch {
        throw new AppError('AUTH_INVALID_TOKEN');
    }
}
