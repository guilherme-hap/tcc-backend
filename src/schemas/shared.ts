import { z } from 'zod';

export const httpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export const httpMethodSchema = z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(httpMethodEnum);

export type HttpMethodInput = z.infer<typeof httpMethodSchema>;
