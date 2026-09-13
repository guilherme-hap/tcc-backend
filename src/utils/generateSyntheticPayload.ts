import { sample } from 'openapi-sampler';
import crypto from 'node:crypto';

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

/**
 * OBS: Por enquanto olha apenas o primeiro nível dos campos de payload,
 * é necessário que ele seja recursivo para que os campos aninhados também recebam o sufixo.
 * Por enquanto essa limitação é aceitável pois geralmente os campos que precisam de identificação estão no primeiro nível.
 */
function applyRandomization(payload: any, schema: any): void {
    if (!payload || typeof payload !== 'object') return;

    const properties = schema?.properties || {};

    for (const key of Object.keys(payload)) {
        const value = payload[key];
        if (typeof value !== 'string') continue;

        const propSchema = properties[key];
        if (!shouldRandomizeField(key, propSchema)) continue;

        const maxLength: number | undefined = propSchema?.maxLength;

        if (maxLength !== undefined && maxLength < SUFFIX_LENGTH + 1) continue;

        const suffix = `-${crypto.randomUUID().slice(0, 8)}`;

        if (maxLength !== undefined && value.length + SUFFIX_LENGTH > maxLength) {
            payload[key] = value.slice(0, maxLength - SUFFIX_LENGTH) + suffix;
        } else {
            payload[key] = value + suffix;
        }
    }
}

/**
 * OBS: Por enquanto olha apenas o primeiro nível dos campos de payload, o mesmo que applyRandomization.
 */
function applyFormatOverrides(payload: any, schema: any): void {
    if (!payload || typeof payload !== 'object') return;

    const properties = schema?.properties || {};

    for (const key of Object.keys(properties)) {
        const propSchema = properties[key];
        if (!propSchema?.format) continue;

        if (!(key in payload)) continue;

        switch (propSchema.format) {
            case 'email':
                payload[key] = `synthetic-${crypto.randomUUID().slice(0, 8)}@example.com`;
                break;
            case 'uuid':
                payload[key] = crypto.randomUUID();
                break;
            case 'date-time':
                payload[key] = new Date().toISOString();
                break;
            case 'date':
                payload[key] = new Date().toISOString().split('T')[0];
                break;
            default:
                break;
        }
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
        return transformPayload(operationSchema.example, operationSchema);
    }
    if (operationSchema.examples && typeof operationSchema.examples === 'object') {
        const firstKey = Object.keys(operationSchema.examples)[0];
        if (firstKey !== undefined) {
            const exampleEntry = operationSchema.examples[firstKey];
            const value = exampleEntry?.value ?? exampleEntry;
            if (value !== undefined) {
                return transformPayload(value, operationSchema);
            }
        }
    }

    try {
        const generated = sample(operationSchema, {}, fullSpec);
        if (generated !== undefined && generated !== null) {
            return transformPayload(generated, operationSchema);
        }
    } catch (err) {
        console.warn('[PayloadGen] openapi-sampler failed to generate sample:', err);
    }

    return undefined;
}

function transformPayload(value: any, schema: any): Record<string, any> {
    const cloned = JSON.parse(JSON.stringify(value));
    applyRandomization(cloned, schema);
    applyFormatOverrides(cloned, schema);
    return cloned;
}
