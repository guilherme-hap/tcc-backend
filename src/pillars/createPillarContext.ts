import { fetchOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import { resolveBaseUrlFromSpec } from '../utils/resolveBaseUrl.js';
import { assertPublicTarget } from '../utils/outboundGuard.js';
import type { PillarBaseParams, PillarResources } from './types.js';

function memoize<T>(load: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | undefined;
    return () => (pending ??= load());
}

export function createPillarContext<P extends PillarBaseParams>(params: P): PillarResources<P> {
    const spec = memoize(() => fetchOpenApiContent(params.openApiUrl));

    const apiBaseUrl = memoize(async () => {
        const informed = params.apiBaseUrl?.trim();
        const baseUrl = informed || resolveBaseUrlFromSpec((await spec()).data, params.openApiUrl);
        await assertPublicTarget(baseUrl);
        return baseUrl;
    });

    return { params, spec, apiBaseUrl };
}
