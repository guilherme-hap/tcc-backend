import { buildTargetUrl } from './resolveBaseUrl.js';
import { resolvePathParameters } from './resolvePathParameters.js';
import { findRequestBodySchema } from './findOperationSchema.js';
import { generateSyntheticPayload } from './generateSyntheticPayload.js';
import { isMutatingMethod } from './httpMethodUtils.js';
import type { ILoadTestOptions } from '../interfaces/evaluation.interface.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type { HttpMethod } from '../schemas/shared.js';

export function resolveTargetUrl(
    spec: any,
    baseUrl: string,
    targetPath: string,
    method: HttpMethod,
    pathParams?: Record<string, string>,
): string {
    return buildTargetUrl(baseUrl, resolvePathParameters(targetPath, spec, method, pathParams));
}

export function prepareLoadTestOptions(params: {
    method: HttpMethod;
    payload?: any;
    loadTestOptions?: LoadTestOptionsInput;
    spec: any;
    targetPath: string;
}): ILoadTestOptions {
    const { method, payload, loadTestOptions, spec, targetPath } = params;
    const { body: globalBody, ...restOptions } = loadTestOptions ?? {};

    const canHaveBody = isMutatingMethod(method) && method !== 'DELETE';

    let body: string | undefined;
    if (payload !== undefined && payload !== null) {
        body = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    } else if (canHaveBody) {
        body = globalBody;
    }

    let payloadFactory: (() => string | undefined) | undefined;
    if (body === undefined && canHaveBody) {
        const schema = findRequestBodySchema(spec, targetPath, method);
        if (schema) {
            payloadFactory = () => {
                const syntheticPayload = generateSyntheticPayload(schema, spec);
                return syntheticPayload ? JSON.stringify(syntheticPayload) : undefined;
            };
        }
    }

    return {
        ...restOptions,
        method,
        ...(body !== undefined && { body }),
        ...(payloadFactory && { payloadFactory }),
    };
}
