export const DEFAULT_WEIGHTS = {
    contract: 1 / 3,
    performance: 1 / 3,
    security: 1 / 3,
} as const;

export type EvaluationWeights = typeof DEFAULT_WEIGHTS;

export function resolveWeights(weights?: Partial<EvaluationWeights>): EvaluationWeights {
    return {
        contract: weights?.contract ?? DEFAULT_WEIGHTS.contract,
        performance: weights?.performance ?? DEFAULT_WEIGHTS.performance,
        security: weights?.security ?? DEFAULT_WEIGHTS.security,
    };
}
