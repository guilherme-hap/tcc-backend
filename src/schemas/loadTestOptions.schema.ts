import { z } from 'zod';
import { httpMethodSchema } from './shared.js';

import {
    DEFAULT_LOAD_LIMITS,
    ELEVATED_LOAD_LIMITS,
    MAX_TARGETS,
    MAX_TOTAL_DURATION_SECONDS,
    DEFAULT_DURATION_SECONDS,
    DEFAULT_TARGET_LATENCY_MS,
    apdexWindowIssue,
    defaultDurationFor,
} from '../utils/loadTestLimits.js';

export {
    DEFAULT_LOAD_LIMITS,
    ELEVATED_LOAD_LIMITS,
    MAX_TARGETS,
    MAX_TOTAL_DURATION_SECONDS,
    DEFAULT_DURATION_SECONDS,
};

const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HEADER_VALUE_FORBIDDEN_PATTERN = /[\r\n\0]/;

const headersSchema = z.record(z.string(), z.string()).superRefine((headers, ctx) => {
    for (const [name, value] of Object.entries(headers)) {
        if (!HEADER_NAME_PATTERN.test(name)) {
            ctx.addIssue({
                code: 'custom',
                path: [name],
                message: 'Nome inválido para um cabeçalho HTTP: use letras, dígitos e hífens, sem espaços nem dois-pontos (ex.: X-Api-Key).',
            });
        } else if (HEADER_VALUE_FORBIDDEN_PATTERN.test(value)) {
            ctx.addIssue({
                code: 'custom',
                path: [name],
                message: 'O valor não pode conter quebra de linha.',
            });
        }
    }
});

export const loadTestOptionsShape = {
    duration: z.number().positive().optional(),
    connections: z.number().int().positive().optional(),
    targetLatency: z.number().positive().optional(),
    maxRequests: z.number().int().positive().optional(),
    requestsPerSecond: z.number().positive().optional(),
    method: httpMethodSchema.optional(),
    headers: headersSchema.optional(),
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
    { field: 'duration', limitKey: 'MAX_DURATION_SECONDS', unit: 'segundos' },
    { field: 'connections', limitKey: 'MAX_CONNECTIONS' },
    { field: 'maxRequests', limitKey: 'MAX_REQUESTS' },
    { field: 'requestsPerSecond', limitKey: 'MAX_REQUESTS_PER_SECOND' },
] as const;

export const loadTestOptionsSchema = baseLoadTestOptionsSchema.superRefine((data, ctx) => {
    const limits = data.allowHighLoad ? ELEVATED_LOAD_LIMITS : DEFAULT_LOAD_LIMITS;
    const tierLabel = data.allowHighLoad ? 'elevado' : 'padrão';

    for (const { field, limitKey, unit } of LIMITED_FIELDS) {
        const value = data[field];
        if (value === undefined) continue;

        const max = limits[limitKey];
        if (value <= max) continue;

        const unitSuffix = unit ? ` ${unit}` : '';
        const elevatedMax = ELEVATED_LOAD_LIMITS[limitKey];
        const fitsInElevated = !data.allowHighLoad && value <= elevatedMax;

        const hint = fitsInElevated
            ? ' Para usar limites maiores, habilite a carga elevada (allowHighLoad).'
            : '';

        ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `Excede o limite ${tierLabel} de ${max.toLocaleString('pt-BR')}${unitSuffix} (recebido: ${value.toLocaleString('pt-BR')}).${hint}`,
        });
    }

    const windowIssue = apdexWindowIssue(
        data.duration ?? defaultDurationFor(data.method),
        data.targetLatency ?? DEFAULT_TARGET_LATENCY_MS,
    );
    if (windowIssue) {
        ctx.addIssue({
            code: 'custom',
            path: [data.duration !== undefined ? 'duration' : 'targetLatency'],
            message: windowIssue,
        });
    }

    if (data.connections !== undefined && data.maxRequests !== undefined && data.connections > data.maxRequests) {
        ctx.addIssue({
            code: 'custom',
            path: ['connections'],
            message: `Não pode ser maior que o máximo de requisições, ${data.maxRequests} (recebido: ${data.connections}).`,
        });
    }
});

export type LoadTestOptionsInput = z.infer<typeof loadTestOptionsSchema>;
