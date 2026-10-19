const PROBE_TIMEOUT_MS = 5000;
const MAX_PROBE_BYTES = 2048;
const MAX_SNIPPET_CHARS = 300;
const MIN_SECRET_LENGTH = 6;
const REDACTED = '[omitido]';
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

export interface FailureProbe {
    statusCode: number;
    bodySnippet: string | null;
}

function secretsFrom(headers: Record<string, string>): string[] {
    return Object.values(headers).flatMap((value) => {
        const lastToken = value.split(/\s+/).pop() ?? '';
        return [value, lastToken].filter((secret) => secret.length >= MIN_SECRET_LENGTH);
    });
}

function redact(text: string, secrets: string[]): string {
    return secrets.reduce((current, secret) => current.split(secret).join(REDACTED), text);
}

async function readLimited(response: Response): Promise<Uint8Array | null> {
    if (!response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        while (total < MAX_PROBE_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            total += value.length;
        }
    } finally {
        await reader.cancel().catch(() => undefined);
    }

    const merged = new Uint8Array(Math.min(total, MAX_PROBE_BYTES));
    let offset = 0;
    for (const chunk of chunks) {
        const room = merged.length - offset;
        if (room <= 0) break;
        merged.set(chunk.subarray(0, room), offset);
        offset += Math.min(chunk.length, room);
    }
    return merged;
}

function toSnippet(bytes: Uint8Array, secrets: string[]): string | null {
    let text: string;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    } catch {
        return null;
    }

    const cleaned = redact(text.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim(), secrets);
    if (cleaned.length === 0) return null;
    return cleaned.length > MAX_SNIPPET_CHARS ? `${cleaned.slice(0, MAX_SNIPPET_CHARS)}…` : cleaned;
}

export async function probeFailure(
    url: string,
    method: string,
    headers: Record<string, string>,
): Promise<FailureProbe | null> {
    try {
        const response = await fetch(url, {
            method,
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        const bytes = method === 'HEAD' ? null : await readLimited(response);
        return {
            statusCode: response.status,
            bodySnippet: bytes ? toSnippet(bytes, secretsFrom(headers)) : null,
        };
    } catch {
        return null;
    }
}
