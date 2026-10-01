import { z } from 'zod';

export const httpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export const httpMethodSchema = z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(httpMethodEnum);

export type HttpMethodInput = z.infer<typeof httpMethodSchema>;

export const httpUrl = z.url({ protocol: /^https?$/ });

export const rulesConfigSchema = z.record(z.string(), z.boolean());

export const severityWeightsSchema = z.partialRecord(
    z.enum(['Error', 'Warning', 'Info', 'Hint', 'Unknown']),
    z.number().min(0),
);
