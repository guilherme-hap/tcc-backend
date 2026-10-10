import axios from 'axios';

const FETCH_TIMEOUT_MS = Number(process.env.OPENAPI_FETCH_TIMEOUT_MS) || 15_000;
const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

export function createFetchDeadline(): AbortSignal {
    return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

export async function fetchRemoteText(url: string, deadline: AbortSignal = createFetchDeadline()): Promise<string> {
    const response = await axios.get<string>(url, {
        timeout: FETCH_TIMEOUT_MS,
        signal: deadline,
        maxContentLength: MAX_CONTENT_BYTES,
        maxRedirects: 3,
        responseType: 'text',
        transformResponse: (r) => r,
    });
    return response.data;
}

export function describeFetchError(err: any): string {
    if (err?.response?.status) {
        return `HTTP ${err.response.status}`;
    }
    if (axios.isCancel(err)) {
        return `prazo de ${FETCH_TIMEOUT_MS / 1000} s excedido`;
    }
    if (String(err?.message).includes('maxContentLength')) {
        return `tamanho máximo de ${MAX_CONTENT_BYTES / 1024 / 1024} MB excedido`;
    }
    return String(err?.code ?? err?.message ?? 'unknown error');
}
