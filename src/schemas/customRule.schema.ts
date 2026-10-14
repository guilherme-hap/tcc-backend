import { z } from 'zod';
import { atLeastOneField, rulesConfigSchema, severityWeightsSchema } from './shared.js';

export const createCustomRuleSchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome'),
    rulesConfig: rulesConfigSchema,
    severityWeights: severityWeightsSchema.nullable().optional(),
});

export type CreateCustomRuleInput = z.infer<typeof createCustomRuleSchema>;

export const updateCustomRuleSchema = atLeastOneField(z.object({
    name: z.string().trim().min(1, 'O nome não pode ficar vazio').optional(),
    rulesConfig: rulesConfigSchema.optional(),
    severityWeights: severityWeightsSchema.nullable().optional(),
}));

export type UpdateCustomRuleInput = z.infer<typeof updateCustomRuleSchema>;
