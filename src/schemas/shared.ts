import { z } from 'zod';
import { isSpectralRule } from '../utils/spectralRules.js';

export const httpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

export const httpMethodSchema = z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(httpMethodEnum);

export type HttpMethodInput = z.infer<typeof httpMethodSchema>;

export const httpUrl = z.url({ protocol: /^https?$/ });

export const idSchema = z.guid();

export const rulesConfigSchema = z.record(z.string(), z.boolean()).superRefine((rules, ctx) => {
    for (const name of Object.keys(rules)) {
        if (!isSpectralRule(name)) {
            ctx.addIssue({
                code: 'custom',
                path: [name],
                message: 'Regra desconhecida. Os nomes válidos estão no catálogo de regras (GET /api/rules).',
            });
        }
    }
});

export const severityWeightsSchema = z.partialRecord(
    z.enum(['Error', 'Warning', 'Info', 'Hint', 'Unknown']),
    z.number().min(0),
);
