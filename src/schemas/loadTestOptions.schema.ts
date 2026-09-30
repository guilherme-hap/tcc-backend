import { z } from 'zod';
import { httpMethodSchema } from './shared.js';

import {
    DEFAULT_LOAD_LIMITS,
    ELEVATED_LOAD_LIMITS,
    MAX_TARGETS,
    MAX_TOTAL_DURATION_SECONDS,
    DEFAULT_DURATION_SECONDS,
} from '../utils/loadTestLimits.js';

export {
    DEFAULT_LOAD_LIMITS,
    ELEVATED_LOAD_LIMITS,
    MAX_TARGETS,
    MAX_TOTAL_DURATION_SECONDS,
    DEFAULT_DURATION_SECONDS,
};

export const loadTestOptionsShape = {
    duration: z.number().positive().optional(),
    connections: z.number().int().positive().optional(),
    targetLatency: z.number().positive().optional(),
    maxRequests: z.number().int().positive().optional(),
    requestsPerSecond: z.number().positive().optional(),
    method: httpMethodSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    allowMutatingMethods: z.boolean().optional(),
    allowHighLoad: z.boolean().optional(),
};

const baseLoadTestOptionsSchema = z.object(loadTestOptionsShape);
type RawLoadTestOptions = z.infer<typeof baseLoadTestOptionsSchema>;

type LimitedNumericField = {
    [K in keyof RawLoadTestOptions]-?: NonNullable<RawLoadTestOptions[K]> extends number ? K : never;
}[keyof RawLoadTestOptions];

interface LimitedField {
    field: LimitedNumericField;
    limitKey: keyof typeof DEFAULT_LOAD_LIMITS;
    unit?: string;
}

const LIMITED_FIELDS: readonly LimitedField[] = [
    { field: 'duration', limitKey: 'MAX_DURATION_SECONDS', unit: 'seconds' },
    { field: 'connections', limitKey: 'MAX_CONNECTIONS' },
    { field: 'maxRequests', limitKey: 'MAX_REQUESTS' },
    { field: 'requestsPerSecond', limitKey: 'MAX_REQUESTS_PER_SECOND' },
] as const;

export const loadTestOptionsSchema = baseLoadTestOptionsSchema.superRefine((data, ctx) => {
    const limits = data.allowHighLoad ? ELEVATED_LOAD_LIMITS : DEFAULT_LOAD_LIMITS;
    const tierLabel = data.allowHighLoad ? 'elevated' : 'default';

    for (const { field, limitKey, unit } of LIMITED_FIELDS) {
        const value = data[field];
        if (value === undefined) continue;

        const max = limits[limitKey];
        if (value <= max) continue;

        const unitSuffix = unit ? ` ${unit}` : '';
        const elevatedMax = ELEVATED_LOAD_LIMITS[limitKey];
        const fitsInElevated = !data.allowHighLoad && value <= elevatedMax;

        const hint = fitsInElevated
            ? ' To use higher limits, set allowHighLoad: true in loadTestOptions.'
            : '';

        ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `${field} exceeds the ${tierLabel} maximum of ${max.toLocaleString('en-US')}${unitSuffix} (received ${value.toLocaleString('en-US')}).${hint}`,
        });
    }
});

export type LoadTestOptionsInput = z.infer<typeof loadTestOptionsSchema>;
