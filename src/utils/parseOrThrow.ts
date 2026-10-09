import type { z } from 'zod';
import '../config/zod.js';
import { ValidationError } from '../errors/ValidationError.js';

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
    const result = schema.safeParse(data);

    if (!result.success) {
        throw new ValidationError(
            result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        );
    }

    return result.data;
}
