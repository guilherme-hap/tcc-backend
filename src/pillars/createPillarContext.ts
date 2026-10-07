import { fetchOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import { resolveBaseUrlFromSpec } from '../utils/resolveBaseUrl.js';
import type { PillarBaseParams, PillarContext } from './types.js';

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | undefined;
    return () => (pending ??= load());
}

export function createPillarContext<P extends PillarBaseParams>(params: P): PillarContext<P> {
    const spec = memoize(() => fetchOpenApiContent(params.openApiUrl));

    const apiBaseUrl = memoize(async () => {
        const informed = params.apiBaseUrl?.trim();
        if (informed) return informed;
        const content = await spec();
        return resolveBaseUrlFromSpec(content.data, params.openApiUrl);
    });

    return { params, spec, apiBaseUrl };
}
