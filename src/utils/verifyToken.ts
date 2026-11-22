import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/data-source.js';
import { User } from '../entities/User.js';
import { AppError } from '../errors/AppError.js';
import { jwtSecret } from './jwtSecret.js';

export interface TokenPayload {
    sub: string;
    ver: number;
    [key: string]: unknown;
}

export async function verifyToken(authHeader: string | undefined): Promise<TokenPayload | null> {
    if (!authHeader) return null;

    if (!authHeader.startsWith('Bearer ') || authHeader.length <= 7) {
        throw new AppError('AUTH_INVALID_TOKEN');
    }

    let payload: TokenPayload;
    try {
        payload = jwt.verify(authHeader.slice(7), jwtSecret()) as TokenPayload;
    } catch {
        throw new AppError('AUTH_INVALID_TOKEN');
    }

    const user = await AppDataSource.getRepository(User).findOne({
        select: { id: true, tokenVersion: true },
        where: { id: payload.sub },
    });
    if (!user || user.tokenVersion !== payload.ver) {
        throw new AppError('AUTH_INVALID_TOKEN');
    }
    return payload;
}
