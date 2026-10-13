import { sample } from 'openapi-sampler';
import crypto from 'node:crypto';
import { resolveRef } from './specRefs.js';

const RANDOMIZE_EXCLUDE_NAMES = new Set([
    'cnpj', 'cpf', 'document', 'taxid', 'tax_id',
    'phone', 'telephone', 'cellphone', 'fax',
    'zipcode', 'zip_code', 'cep', 'postalcode', 'postal_code',
]);

const DEDICATED_FORMATS = new Set(['date', 'date-time', 'uuid', 'email']);

const SUFFIX_LENGTH = 9;

function shouldRandomizeField(fieldName: string, propSchema: any): boolean {
    if (propSchema?.type !== 'string') return false;
    if (propSchema.enum) return false;
    if (propSchema.pattern) return false;
    if (DEDICATED_FORMATS.has(propSchema?.format)) return false;
    if (RANDOMIZE_EXCLUDE_NAMES.has(fieldName.toLowerCase())) return false;
    return true;
}

function randomizeString(value: string, maxLength: number | undefined): string {
    if (maxLength !== undefined && maxLength < SUFFIX_LENGTH + 1) return value;

    const suffix = `-${crypto.randomUUID().slice(0, 8)}`;

    if (maxLength !== undefined && value.length + SUFFIX_LENGTH > maxLength) {
        return value.slice(0, maxLength - SUFFIX_LENGTH) + suffix;
    }
    return value + suffix;
}

function valueForFormat(format: unknown): string | undefined {
    switch (format) {
        case 'email':
            return `synthetic-${crypto.randomUUID().slice(0, 8)}@example.com`;
        case 'uuid':
            return crypto.randomUUID();
        case 'date-time':
            return new Date().toISOString();
        case 'date':
            return new Date().toISOString().split('T')[0];
        default:
            return undefined;
    }
}

function transformField(fieldName: string, value: any, rawSchema: any, spec: any): any {
    const schema = resolveRef(spec, rawSchema);

    const formatted = valueForFormat(schema?.format);
    if (formatted !== undefined) {
        return formatted;
    }
    if (typeof value === 'string') {
        return shouldRandomizeField(fieldName, schema) ? randomizeString(value, schema.maxLength) : value;
    }
    if (Array.isArray(value)) {
        return value.map((item) => transformField(fieldName, item, schema?.items, spec));
    }
    if (value && typeof value === 'object') {
        transformProperties(value, schema, spec);
    }
    return value;
}

function transformProperties(payload: Record<string, any>, schema: any, spec: any): void {
    const properties = schema?.properties || {};

    for (const key of Object.keys(payload)) {
        payload[key] = transformField(key, payload[key], properties[key], spec);
    }
}

export function generateSyntheticPayload(
    operationSchema: any,
    fullSpec: any,
): Record<string, any> | undefined {
    if (!operationSchema) {
        return undefined;
    }

    if (operationSchema.example !== undefined) {
        return transformPayload(operationSchema.example, operationSchema, fullSpec);
    }
    if (operationSchema.examples && typeof operationSchema.examples === 'object') {
        const firstKey = Object.keys(operationSchema.examples)[0];
        if (firstKey !== undefined) {
            const exampleEntry = operationSchema.examples[firstKey];
            const value = exampleEntry?.value ?? exampleEntry;
            if (value !== undefined) {
                return transformPayload(value, operationSchema, fullSpec);
            }
        }
    }

    try {
        const generated = sample(operationSchema, {}, fullSpec);
        if (generated !== undefined && generated !== null) {
            return transformPayload(generated, operationSchema, fullSpec);
        }
    } catch (err) {
        console.warn('[PayloadGen] openapi-sampler failed to generate sample:', err);
    }

    return undefined;
}

function transformPayload(value: any, schema: any, spec: any): Record<string, any> {
    const cloned = JSON.parse(JSON.stringify(value));

    if (Array.isArray(cloned)) {
        const itemSchema = resolveRef(spec, schema?.items);
        return cloned.map((item) => transformField('', item, itemSchema, spec));
    }
    if (cloned && typeof cloned === 'object') {
        transformProperties(cloned, schema, spec);
    }
    return cloned;
}
