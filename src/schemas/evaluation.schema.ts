import { z } from 'zod';
import { loadTestOptionsSchema } from './loadTestOptions.schema.js';
import { httpMethodSchema } from './shared.js';

export const performanceRequestSchema = z.object({
    openApiUrl: z.url('openApiUrl must be a valid URL'),
    targetPath: z.string().trim().min(1, 'targetPath is required'),
    apiBaseUrl: z.url().trim().optional(),
    targetMethod: httpMethodSchema.optional(),
    payload: z.any().optional(),
    loadTestOptions: loadTestOptionsSchema.optional(),
});

export type PerformanceRequestInput = z.infer<typeof performanceRequestSchema>;

const DEFAULT_WEIGHT = 1 / 3;

export const fullEvaluationRequestSchema = z.object({
    openApiUrl: z.url('openApiUrl must be a valid URL'),
    targetPath: z.string().trim().min(1, 'targetPath is required'),
    apiBaseUrl: z.url().trim().optional(),
    targetMethod: httpMethodSchema.optional(),
    payload: z.any().optional(),
    rulesConfig: z.record(z.string(), z.boolean()).optional(),
    severityWeights: z
        .record(
            z.enum(['Error', 'Warning', 'Info', 'Hint', 'Unknown']),
            z.number(),
        )
        .optional(),
    loadTestOptions: loadTestOptionsSchema.optional(),
    weights: z
        .object({
            contract: z.number().min(0).optional(),
            performance: z.number().min(0).optional(),
            security: z.number().min(0).optional(),
        })
        .optional()
        .superRefine((weights, ctx) => {
            if (!weights) return;

            const hasContract = weights.contract !== undefined;
            const hasPerformance = weights.performance !== undefined;
            const hasSecurity = weights.security !== undefined;

            if (!hasContract && !hasPerformance && !hasSecurity) return;

            const contractWeight = weights.contract ?? DEFAULT_WEIGHT;
            const performanceWeight = weights.performance ?? DEFAULT_WEIGHT;
            const securityWeight = weights.security ?? DEFAULT_WEIGHT;

            const sum = contractWeight + performanceWeight + securityWeight;
            if (Math.abs(sum - 1) > 0.001) {
                const formatWeight = (val: number, isExplicit: boolean) =>
                    isExplicit ? `${val}` : `${Number(val.toFixed(4))} (default 1/3)`;

                const hasDefaulted = !hasContract || !hasPerformance || !hasSecurity;
                const note = hasDefaulted
                    ? ' Note: omitted weights automatically use their default (1/3). When customizing weights, specify all three or ensure the sum including defaults equals 1.'
                    : '';

                ctx.addIssue({
                    code: 'custom',
                    message: `Weights must sum to 1. Received: contract=${formatWeight(contractWeight, hasContract)}, performance=${formatWeight(performanceWeight, hasPerformance)}, security=${formatWeight(securityWeight, hasSecurity)} (sum=${Number(sum.toFixed(4))}).${note}`,
                });
            }
        }),
});

export type FullEvaluationRequestInput = z.infer<typeof fullEvaluationRequestSchema>;
