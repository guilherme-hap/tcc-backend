import { SpectralService } from '../services/SpectralService.js';
import { buildContractResult, calculateContractScore, resolveSeverityWeights } from '../utils/calculateContractScore.js';
import { withMeasurementLock } from '../utils/measurementLock.js';
import type { ContractRequestInput } from '../schemas/evaluation.schema.js';
import type { Pillar } from './types.js';

const spectralService = new SpectralService();

export const contractPillar: Pillar<ContractRequestInput, 'spectralResult'> = {
    name: 'contract',
    column: 'spectralResult',
    run: async (ctx) => {
        const { openApiUrl, rulesConfig, severityWeights } = ctx.params;
        const content = await ctx.spec();
        const analysis = await withMeasurementLock(() => spectralService.analyze(openApiUrl, rulesConfig || {}, content));

        return {
            ...calculateContractScore(analysis.issues, analysis.rules, severityWeights),
            result: buildContractResult(analysis),
            scoring: {
                contract: {
                    severityWeights: resolveSeverityWeights(severityWeights),
                    rules: analysis.rules,
                },
            },
        };
    },
};
