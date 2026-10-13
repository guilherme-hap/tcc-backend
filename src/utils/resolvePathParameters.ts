import { sample } from 'openapi-sampler';
import crypto from 'node:crypto';
import { findMatchingSpecPath } from './findMatchingSpecPath.js';
import { resolveRef } from './specRefs.js';

export function resolvePathParameters(
    targetPath: string,
    spec: any,
    method: string,
    pathParams: Record<string, string> = {},
): string {
    if (!targetPath.includes('{')) {
        return targetPath;
    }

    const usesSyntheticValues = method.toUpperCase() !== 'DELETE';
    const paramDefs = usesSyntheticValues
        ? collectParameterDefs(spec, findMatchingSpecPath(targetPath, spec), method.toLowerCase())
        : new Map<string, any>();

    return targetPath.replace(/\{([^}]+)\}/g, (placeholder, paramName: string) => {
        if (Object.hasOwn(pathParams, paramName)) {
            return encodeURIComponent(pathParams[paramName]);
        }
        if (!usesSyntheticValues) {
            return placeholder;
        }
        return generatePathParamValue(paramDefs.get(paramName), paramName, spec);
    });
}

function collectParameterDefs(
    spec: any,
    specPath: string | undefined,
    method: string,
): Map<string, any> {
    const params = new Map<string, any>();
    if (!specPath || !spec?.paths?.[specPath]) return params;

    const pathItem = spec.paths[specPath];

    for (const owner of [pathItem, pathItem[method]]) {
        if (!Array.isArray(owner?.parameters)) continue;

        for (const rawParam of owner.parameters) {
            const param = resolveRef(spec, rawParam);
            if (param?.in === 'path' && param.name) {
                params.set(param.name, param);
            }
        }
    }

    return params;
}

function generatePathParamValue(paramDef: any | undefined, paramName: string, spec: any): string {
    const schema = paramDef?.schema ?? (paramDef?.type ? paramDef : undefined);
    if (schema) {
        try {
            const value = sample(schema, {}, spec ?? {});
            if (value !== undefined && value !== null) {
                return String(value);
            }
        } catch {
        }
    }

    const nameLower = paramName.toLowerCase();

    if (nameLower.includes('uuid') || nameLower.includes('guid')) {
        return crypto.randomUUID();
    }

    return String(Math.floor(Math.random() * 9999) + 1);
}
