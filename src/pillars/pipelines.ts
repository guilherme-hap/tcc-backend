import { auditMessage } from '../messages/catalog.js';
import type { IAuditMessage } from '../messages/catalog.js';
import { resolveWeights } from '../utils/weights.js';
import { contractPillar } from './contractPillar.js';
import { performancePillar } from './performancePillar.js';
import { securityPillar } from './securityPillar.js';
import type { PillarName, PillarResults, Pipelines } from './types.js';

const BLOCKING_ERROR_RULES = new Set(['oas2-schema', 'oas3-schema', 'parser']);
const UNRECOGNIZED_FORMAT_RULE = 'unrecognized-format';

function requireValidSpecForLoadTest(pillar: PillarName, results: Partial<PillarResults>): IAuditMessage | null {
    if (pillar !== 'performance') return null;

    const structuralError = results.spectralResult?.issues.find((issue) => {
        const rule = String(issue.rule);
        return rule === UNRECOGNIZED_FORMAT_RULE || (issue.severity === 'Error' && BLOCKING_ERROR_RULES.has(rule));
    });
    return structuralError
        ? auditMessage('PERF_SKIPPED_INVALID_SPEC', { rule: String(structuralError.rule) })
        : null;
}

export const PIPELINES: Pipelines = {
    contract: { stages: [[contractPillar]], weights: () => ({ contract: 1 }) },
    performance: { stages: [[performancePillar]], weights: () => ({ performance: 1 }) },
    security: { stages: [[securityPillar]], weights: () => ({ security: 1 }) },
    full: {
        stages: [[contractPillar, securityPillar], [performancePillar]],
        weights: ({ weights }) => resolveWeights(weights),
        precondition: requireValidSpecForLoadTest,
    },
};
