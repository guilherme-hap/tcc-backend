import { resolveBaseUrlFromSpec, buildTargetUrl } from './resolveBaseUrl.js';
import { fetchOpenApiSpec } from './fetchOpenApiSpec.js';
import { resolvePathParameters } from './resolvePathParameters.js';
import { findRequestBodySchema } from './findOperationSchema.js';
import { generateSyntheticPayload } from './generateSyntheticPayload.js';
import { isMutatingMethod } from './httpMethodUtils.js';
import { ILoadTestOptions, HttpMethod } from '../interfaces/evaluation.interface.js';

export async function resolveTargetUrlWithSpec(
    openApiUrl: string,
    targetPath: string,
    apiBaseUrl?: string | null,
    method?: string,
): Promise<{ targetUrl: string; spec: any }> {
    const spec = await fetchOpenApiSpec(openApiUrl);

    const effectiveBaseUrl = apiBaseUrl?.trim()
        ? apiBaseUrl.trim()
        : resolveBaseUrlFromSpec(spec, openApiUrl);

    const effectiveMethod = method?.toUpperCase();
    let resolvedPath = targetPath;
    if (effectiveMethod && effectiveMethod !== 'DELETE' && targetPath.includes('{')) {
        resolvedPath = resolvePathParameters(targetPath, spec, effectiveMethod);
    }

    const targetUrl = buildTargetUrl(effectiveBaseUrl, resolvedPath);

    return { targetUrl, spec };
}

export function prepareLoadTestOptions(params: {
    targetMethod?: HttpMethod | string;
    payload?: any;
    loadTestOptions?: ILoadTestOptions;
    spec?: any;
    targetPath?: string;
}): ILoadTestOptions {
    const { targetMethod, payload, loadTestOptions, spec, targetPath } = params;

    const method = (targetMethod || loadTestOptions?.method) as HttpMethod | undefined;
    const effectiveMethod = method?.toUpperCase();
    const hasExplicitPayload = payload !== undefined && payload !== null;
    const hasExplicitBody = hasExplicitPayload || (loadTestOptions?.body !== undefined);

    let serializedBody: string | undefined;
    if (hasExplicitPayload) {
        serializedBody = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
    } else if (loadTestOptions?.body !== undefined) {
        serializedBody = loadTestOptions.body;
    }

    let payloadFactory: (() => string | undefined) | undefined;
    if (
        !hasExplicitBody &&
        spec &&
        targetPath &&
        effectiveMethod &&
        isMutatingMethod(effectiveMethod) &&
        effectiveMethod !== 'DELETE'
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
        ...loadTestOptions,
        ...(method && { method }),
        headers: {
            ...(loadTestOptions?.headers || {}),
        },
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
        ...(payloadFactory && { payloadFactory }),
    };
}
