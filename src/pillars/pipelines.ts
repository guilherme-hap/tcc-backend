import { DEFAULT_WEIGHTS } from '../utils/weights.js';
import type { EvaluationWeights } from '../utils/weights.js';
import type { FullEvaluationRequestInput } from '../schemas/evaluation.schema.js';
import { contractPillar } from './contractPillar.js';
import { performancePillar } from './performancePillar.js';
import { securityPillar } from './securityPillar.js';
import type { Pipelines } from './types.js';

function resolveFullWeights({ weights }: FullEvaluationRequestInput): EvaluationWeights {
    return {
        contract: weights?.contract ?? DEFAULT_WEIGHTS.contract,
        performance: weights?.performance ?? DEFAULT_WEIGHTS.performance,
        security: weights?.security ?? DEFAULT_WEIGHTS.security,
    };
}

export const PIPELINES: Pipelines = {
    contract: { pillars: [contractPillar], weights: () => ({ contract: 1 }) },
    performance: { pillars: [performancePillar], weights: () => ({ performance: 1 }) },
    security: { pillars: [securityPillar], weights: () => ({ security: 1 }) },
    full: {
        pillars: [contractPillar, performancePillar, securityPillar],
        weights: resolveFullWeights,
    },
};
