import { buildTargetUrl } from './resolveBaseUrl.js';
import { resolvePathParameters } from './resolvePathParameters.js';
import { findRequestBodySchema } from './findOperationSchema.js';
import { generateSyntheticPayload } from './generateSyntheticPayload.js';
import { isMutatingMethod } from './httpMethodUtils.js';
import { ILoadTestOptions, HttpMethod } from '../interfaces/evaluation.interface.js';

export function resolveTargetUrl(
    spec: any,
    baseUrl: string,
    targetPath: string,
    method?: string,
): string {
    const effectiveMethod = method?.toUpperCase();
    let resolvedPath = targetPath;
    if (effectiveMethod && effectiveMethod !== 'DELETE' && targetPath.includes('{')) {
        resolvedPath = resolvePathParameters(targetPath, spec, effectiveMethod);
    }

    return buildTargetUrl(baseUrl, resolvedPath);
}

export function prepareLoadTestOptions(params: {
    targetMethod?: HttpMethod | string;
    payload?: any;
    loadTestOptions?: ILoadTestOptions;
    spec?: any;
    targetPath?: string;
}): ILoadTestOptions {
    const { targetMethod, payload, loadTestOptions, spec, targetPath } = params;
    const { body: globalBody, ...restOptions } = loadTestOptions || {};

    const method = (targetMethod || loadTestOptions?.method) as HttpMethod | undefined;
    const effectiveMethod = method?.toUpperCase();
    const isMutating = isMutatingMethod(effectiveMethod);
    const canHaveBody = isMutating && effectiveMethod !== 'DELETE';
    const hasExplicitPayload = payload !== undefined && payload !== null;
    const hasExplicitBody = hasExplicitPayload || (canHaveBody && globalBody !== undefined);

    let serializedBody: string | undefined;
    if (hasExplicitPayload) {
        serializedBody = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    } else if (canHaveBody && globalBody !== undefined) {
        serializedBody = globalBody;
    }

    let payloadFactory: (() => string | undefined) | undefined;
    if (
        !hasExplicitBody &&
        spec &&
        targetPath &&
        effectiveMethod &&
        canHaveBody
    ) {
        const schema = findRequestBodySchema(spec, targetPath, effectiveMethod);
        if (schema) {
            payloadFactory = () => {
                const syntheticPayload = generateSyntheticPayload(schema, spec);
                return syntheticPayload ? JSON.stringify(syntheticPayload) : undefined;
            };
        }
    }

    return {
        ...restOptions,
        ...(method && { method }),
        headers: {
            ...(loadTestOptions?.headers || {}),
        },
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
        ...(payloadFactory && { payloadFactory }),
    };
}
