import { z } from 'zod';
import { DEFAULT_WEIGHTS } from '../utils/weights.js';
import { MAX_TARGETS, validateTotalDuration } from '../utils/loadTestLimits.js';
import { loadTestOptionsSchema } from './loadTestOptions.schema.js';
import { httpMethodSchema, httpUrl, rulesConfigSchema } from './shared.js';

export { validateTotalDuration };

const severityWeightsSchema = z.partialRecord(
    z.enum(['Error', 'Warning', 'Info', 'Hint', 'Unknown']),
    z.number().min(0),
);

export const contractRequestSchema = z.object({
    openApiUrl: httpUrl,
    rulesConfig: rulesConfigSchema.optional(),
    severityWeights: severityWeightsSchema.optional(),
});

export type ContractRequestInput = z.infer<typeof contractRequestSchema>;

export const securityRequestSchema = z.object({
    openApiUrl: httpUrl,
    apiBaseUrl: httpUrl.trim().optional(),
});

export type SecurityRequestInput = z.infer<typeof securityRequestSchema>;

export const performanceTargetSchema = z.object({
    path: z.string().trim().min(1, 'path is required'),
    method: httpMethodSchema.optional(),
    payload: z.any().optional(),
});

export type PerformanceTargetInput = z.infer<typeof performanceTargetSchema>;

export const performanceRequestSchema = z
    .object({
        openApiUrl: httpUrl,
        apiBaseUrl: httpUrl.trim().optional(),
        targets: z.array(performanceTargetSchema).min(1, 'At least one target is required').max(MAX_TARGETS, `Maximum of ${MAX_TARGETS} targets allowed`),
        loadTestOptions: loadTestOptionsSchema.optional(),
    })
    .superRefine((data, ctx) => {
        validateTotalDuration(data, ctx);
    });

export type PerformanceRequestInput = z.infer<typeof performanceRequestSchema>;

export const fullEvaluationRequestSchema = z
    .object({
        openApiUrl: httpUrl,
        apiBaseUrl: httpUrl.trim().optional(),
        targets: z.array(performanceTargetSchema).min(1, 'At least one target is required').max(MAX_TARGETS, `Maximum of ${MAX_TARGETS} targets allowed`),
        rulesConfig: rulesConfigSchema.optional(),
        severityWeights: severityWeightsSchema.optional(),
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

                const contractWeight = weights.contract ?? DEFAULT_WEIGHTS.contract;
                const performanceWeight = weights.performance ?? DEFAULT_WEIGHTS.performance;
                const securityWeight = weights.security ?? DEFAULT_WEIGHTS.security;

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
    })
    .superRefine((data, ctx) => {
        validateTotalDuration(data, ctx);
    });

export type FullEvaluationRequestInput = z.infer<typeof fullEvaluationRequestSchema>;
