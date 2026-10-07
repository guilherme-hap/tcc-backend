import { SecurityService } from '../services/SecurityService.js';
import { calculateSecurityScore } from '../utils/calculateSecurityScore.js';
import type { SecurityRequestInput } from '../schemas/evaluation.schema.js';
import type { Pillar } from './types.js';

const securityService = new SecurityService();

export const securityPillar: Pillar<SecurityRequestInput, 'securityResult'> = {
    name: 'security',
    column: 'securityResult',
    run: async (ctx) => {
        const results = await securityService.analyze(await ctx.apiBaseUrl());

        return {
            score: calculateSecurityScore(results),
            result: results,
        };
    },
};
