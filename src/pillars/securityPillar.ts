import { SecurityService } from '../services/SecurityService.js';
import { calculateSecurityScore, SECURITY_LAYER_WEIGHTS, SECURITY_STATUS_SCORE } from '../utils/calculateSecurityScore.js';
import type { SecurityRequestInput } from '../schemas/evaluation.schema.js';
import type { Pillar } from './types.js';

const securityService = new SecurityService();

export const securityPillar: Pillar<SecurityRequestInput, 'securityResult'> = {
    name: 'security',
    column: 'securityResult',
    run: async (ctx) => {
        const results = await securityService.analyze(await ctx.apiBaseUrl());

        return {
            ...calculateSecurityScore(results),
            result: results,
            scoring: {
                security: {
                    layerWeights: SECURITY_LAYER_WEIGHTS,
                    statusScores: SECURITY_STATUS_SCORE,
                },
            },
        };
    },
};
