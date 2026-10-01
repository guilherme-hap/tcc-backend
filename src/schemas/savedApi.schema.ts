import { z } from 'zod';
import { httpUrl, rulesConfigSchema } from './shared.js';
import { loadTestOptionsSchema } from './loadTestOptions.schema.js';

const defaultSettingsSchema = z.object({
    rulesConfig: rulesConfigSchema.optional(),
    loadTestOptions: loadTestOptionsSchema.optional(),
});

export const createSavedApiSchema = z.object({
    name: z.string().trim().min(1, 'name is required'),
    openApiUrl: httpUrl,
    apiBaseUrl: httpUrl.trim().optional(),
    defaultSettings: defaultSettingsSchema.optional(),
});

export type CreateSavedApiInput = z.infer<typeof createSavedApiSchema>;

export const updateSavedApiSchema = z
    .object({
        name: z.string().trim().min(1, 'name cannot be empty').optional(),
        openApiUrl: httpUrl.optional(),
        apiBaseUrl: httpUrl.trim().nullable().optional(),
        defaultSettings: defaultSettingsSchema.nullable().optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one field must be provided for update',
    });

export type UpdateSavedApiInput = z.infer<typeof updateSavedApiSchema>;
