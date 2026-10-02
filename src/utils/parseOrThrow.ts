import type { z } from 'zod';
import { AppError } from '../errors/AppError.js';

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
    const result = schema.safeParse(data);

    if (!result.success) {
        const message = result.error.issues
            .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
            .join('; ');

        throw new AppError(message, 400);
    }

    return result.data;
}
