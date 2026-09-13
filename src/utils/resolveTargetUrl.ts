import { resolveBaseUrl, buildTargetUrl } from './resolveBaseUrl.js';
import { ILoadTestOptions, HttpMethod } from '../interfaces/evaluation.interface.js';

export async function resolveTargetUrl(
    openApiUrl: string,
    targetPath: string,
    apiBaseUrl?: string | null
): Promise<string> {
    const effectiveBaseUrl = apiBaseUrl?.trim()
        ? apiBaseUrl.trim()
        : await resolveBaseUrl(openApiUrl);

    return buildTargetUrl(effectiveBaseUrl, targetPath);
}

export function prepareLoadTestOptions(params: {
    targetMethod?: HttpMethod | string;
    payload?: any;
    loadTestOptions?: ILoadTestOptions;
}): ILoadTestOptions {
    const { targetMethod, payload, loadTestOptions } = params;

    const method = (targetMethod || loadTestOptions?.method) as HttpMethod | undefined;
    const hasPayload = payload !== undefined && payload !== null;
    const serializedBody = hasPayload
        ? (typeof payload === 'object' ? JSON.stringify(payload) : String(payload))
        : loadTestOptions?.body;

    return {
        ...loadTestOptions,
        ...(method && { method }),
        headers: {
            ...(hasPayload && typeof payload === 'object' ? { 'content-type': 'application/json' } : {}),
            ...(loadTestOptions?.headers || {}),
        },
        ...(serializedBody !== undefined ? { body: serializedBody } : {}),
    };
}
