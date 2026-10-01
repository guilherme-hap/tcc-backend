import { z } from 'zod';
import { rulesConfigSchema, severityWeightsSchema } from './shared.js';

export const createCustomRuleSchema = z.object({
    name: z.string().trim().min(1, 'name is required'),
    rulesConfig: rulesConfigSchema,
    severityWeights: severityWeightsSchema.nullable().optional(),
});

export type CreateCustomRuleInput = z.infer<typeof createCustomRuleSchema>;

export const updateCustomRuleSchema = z
    .object({
        name: z.string().trim().min(1, 'name cannot be empty').optional(),
        rulesConfig: rulesConfigSchema.optional(),
        severityWeights: severityWeightsSchema.nullable().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one field must be provided for update',
    });

export type UpdateCustomRuleInput = z.infer<typeof updateCustomRuleSchema>;
