import { z } from 'zod';
import { rulesConfigSchema, severityWeightsSchema } from './shared.js';

export const createCustomRuleSchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome'),
    rulesConfig: rulesConfigSchema,
    severityWeights: severityWeightsSchema.nullable().optional(),
});

export type CreateCustomRuleInput = z.infer<typeof createCustomRuleSchema>;

export const updateCustomRuleSchema = z
    .object({
        name: z.string().trim().min(1, 'O nome não pode ficar vazio').optional(),
        rulesConfig: rulesConfigSchema.optional(),
        severityWeights: severityWeightsSchema.nullable().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'Informe ao menos um campo para atualizar',
    });

export type UpdateCustomRuleInput = z.infer<typeof updateCustomRuleSchema>;
