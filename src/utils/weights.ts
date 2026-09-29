export const DEFAULT_WEIGHTS = {
    contract: 1 / 3,
    performance: 1 / 3,
    security: 1 / 3,
} as const;

export type EvaluationWeights = typeof DEFAULT_WEIGHTS;
