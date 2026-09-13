import { sample } from 'openapi-sampler';
import crypto from 'node:crypto';
import { findMatchingSpecPath } from './findMatchingSpecPath.js';

export function resolvePathParameters(
    targetPath: string,
    spec: any,
    method: string,
): string {
    if (!targetPath.includes('{')) {
        return targetPath;
    }

    const normalizedMethod = method.toLowerCase();

    const specPath = findMatchingSpecPath(targetPath, spec);

    const paramDefs = collectParameterDefs(spec, specPath, normalizedMethod);

    return targetPath.replace(/\{([^}]+)\}/g, (_match, paramName: string) => {
        const paramDef = paramDefs.get(paramName);
        return generatePathParamValue(paramDef, paramName, spec);
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

    if (Array.isArray(pathItem.parameters)) {
        for (const param of pathItem.parameters) {
            if (param.in === 'path' && param.name) {
                params.set(param.name, param);
            }
        }
    }

    const operation = pathItem[method];
    if (operation && Array.isArray(operation.parameters)) {
        for (const param of operation.parameters) {
            if (param.in === 'path' && param.name) {
                params.set(param.name, param);
            }
        }
    }

    return params;
}

function generatePathParamValue(paramDef: any | undefined, paramName: string, spec: any): string {
    if (paramDef?.schema) {
        try {
            const value = sample(paramDef.schema, {}, spec ?? {});
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
