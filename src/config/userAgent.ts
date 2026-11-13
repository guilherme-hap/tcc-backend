const DEFAULT_USER_AGENT = 'Specping/1.0 (auditor de APIs REST)';

export function userAgent(): string {
    return process.env.SPECPING_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

export function withUserAgent(headers: Record<string, string> = {}): Record<string, string> {
    const informed = Object.keys(headers).some((name) => name.toLowerCase() === 'user-agent');
    return informed ? headers : { ...headers, 'User-Agent': userAgent() };
}
