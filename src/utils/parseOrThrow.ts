import type { z } from 'zod';
import '../config/zod.js';
import { ValidationError } from '../errors/ValidationError.js';

const NUL = '\u0000';

function collectNulPaths(value: unknown, path: (string | number)[], found: string[]): void {
    if (typeof value === 'string') {
        if (value.includes(NUL)) found.push(path.join('.'));
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => collectNulPaths(item, [...path, index], found));
        return;
    }
    if (typeof value === 'object' && value !== null) {
        for (const [key, item] of Object.entries(value)) {
            const readableKey = key.replaceAll(NUL, '');
            if (readableKey !== key) found.push([...path, readableKey].join('.'));
            collectNulPaths(item, [...path, readableKey], found);
        }
    }
}

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
    const nulPaths: string[] = [];
    collectNulPaths(data, [], nulPaths);
    if (nulPaths.length > 0) {
        throw new ValidationError(
            nulPaths.map((path) => ({ path, message: 'Não pode conter o caractere nulo (\\u0000).' })),
        );
    }

    const result = schema.safeParse(data);

    if (!result.success) {
        throw new ValidationError(
            result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        );
    }

    return result.data;
}
