import { z } from 'zod';
import { EVALUATION_STATUSES, EVALUATION_TYPES } from '../interfaces/evaluation.interface.js';
import type { EvaluationRequestMap, EvaluationType } from '../interfaces/evaluation.interface.js';
import { resolveWeights } from '../utils/weights.js';
import { MAX_TARGETS, validateTargetApdexWindow, validateTotalDuration } from '../utils/loadTestLimits.js';
import { validateTargetMethods } from '../utils/httpMethodUtils.js';
import { loadTestOptionsSchema, type LoadTestOptionsInput } from './loadTestOptions.schema.js';
import { httpMethodSchema, httpUrl, minScoreSchema, rulesConfigSchema, severityWeightsSchema } from './shared.js';

export const contractRequestSchema = z.object({
    openApiUrl: httpUrl,
    rulesConfig: rulesConfigSchema.optional(),
    severityWeights: severityWeightsSchema.optional(),
    minScore: minScoreSchema.optional(),
});

export type ContractRequestInput = z.infer<typeof contractRequestSchema>;

export const securityRequestSchema = z.object({
    openApiUrl: httpUrl,
    apiBaseUrl: httpUrl.trim().optional(),
    minScore: minScoreSchema.optional(),
});

export type SecurityRequestInput = z.infer<typeof securityRequestSchema>;

export const performanceTargetSchema = z.object({
    path: z.string().trim().min(1, 'Informe o path do alvo'),
    method: httpMethodSchema.optional(),
    payload: z.any().optional(),
    pathParams: z.record(z.string(), z.union([z.string().min(1), z.number()]).transform(String)).optional(),
});

export type PerformanceTargetInput = z.infer<typeof performanceTargetSchema>;

function refineTargets(
    data: { targets: PerformanceTargetInput[]; loadTestOptions?: LoadTestOptionsInput },
    ctx: z.RefinementCtx,
): void {
    validateTotalDuration(data, ctx);
    validateTargetMethods(data, ctx);
    validateTargetApdexWindow(data, ctx);
}

export const performanceRequestSchema = z
    .object({
        openApiUrl: httpUrl,
        apiBaseUrl: httpUrl.trim().optional(),
        targets: z.array(performanceTargetSchema).min(1, 'Informe ao menos um alvo').max(MAX_TARGETS, `São permitidos no máximo ${MAX_TARGETS} alvos`),
        loadTestOptions: loadTestOptionsSchema.optional(),
        minScore: minScoreSchema.optional(),
    })
    .superRefine(refineTargets);

export type PerformanceRequestInput = z.infer<typeof performanceRequestSchema>;

export const fullEvaluationRequestSchema = z
    .object({
        openApiUrl: httpUrl,
        apiBaseUrl: httpUrl.trim().optional(),
        targets: z.array(performanceTargetSchema).min(1, 'Informe ao menos um alvo').max(MAX_TARGETS, `São permitidos no máximo ${MAX_TARGETS} alvos`),
        rulesConfig: rulesConfigSchema.optional(),
        severityWeights: severityWeightsSchema.optional(),
        loadTestOptions: loadTestOptionsSchema.optional(),
        minScore: minScoreSchema.optional(),
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

                const resolved = resolveWeights(weights);
                const sum = resolved.contract + resolved.performance + resolved.security;
                if (Math.abs(sum - 1) > 0.001) {
                    const formatWeight = (val: number, isExplicit: boolean) =>
                        isExplicit ? `${val}` : `${Number(val.toFixed(4))} (padrão 1/3)`;

                    const hasDefaulted = !hasContract || !hasPerformance || !hasSecurity;
                    const note = hasDefaulted
                        ? ' Pesos omitidos usam o padrão (1/3): informe os três ou garanta que a soma, incluindo os padrões, seja 1.'
                        : '';

                    ctx.addIssue({
                        code: 'custom',
                        message: `Os pesos devem somar 1. Recebido: contrato=${formatWeight(resolved.contract, hasContract)}, performance=${formatWeight(resolved.performance, hasPerformance)}, segurança=${formatWeight(resolved.security, hasSecurity)} (soma=${Number(sum.toFixed(4))}).${note}`,
                    });
                }
            }),
    })
    .superRefine(refineTargets);

export type FullEvaluationRequestInput = z.infer<typeof fullEvaluationRequestSchema>;

const evaluationTypeEnum = z.enum(EVALUATION_TYPES);
const evaluationStatusEnum = z.enum(EVALUATION_STATUSES);

export const listEvaluationsQuerySchema = z
    .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().max(200).optional(),
        type: evaluationTypeEnum.optional(),
        status: z
            .string()
            .transform((value) => value.split(',').map((item) => item.trim()))
            .pipe(z.array(evaluationStatusEnum))
            .optional(),
        from: z.iso.datetime({ offset: true }).optional(),
        to: z.iso.datetime({ offset: true }).optional(),
    })
    .superRefine((query, ctx) => {
        if (query.from !== undefined && query.to !== undefined && Date.parse(query.from) >= Date.parse(query.to)) {
            ctx.addIssue({
                code: 'custom',
                path: ['to'],
                message: 'O fim do período precisa ser posterior ao início.',
            });
        }
    });

export type ListEvaluationsQuery = z.infer<typeof listEvaluationsQuerySchema>;

export const EVALUATION_SCHEMAS: { [T in EvaluationType]: z.ZodType<EvaluationRequestMap[T]> } = {
    contract: contractRequestSchema,
    performance: performanceRequestSchema,
    security: securityRequestSchema,
    full: fullEvaluationRequestSchema,
};
