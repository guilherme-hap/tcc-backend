import { Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';

export function notFound(_req: Request, _res: Response): void {
    throw new AppError('ROUTE_NOT_FOUND');
}
