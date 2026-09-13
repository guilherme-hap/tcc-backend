export function resolveBaseUrlFromSpec(spec: any, fallbackUrl: string): string {
    try {
        // OpenAPI 3.x
        if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0]?.url) {
            const serverUrl = String(spec.servers[0].url).trim();
            if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
                return serverUrl;
            }
            return new URL(serverUrl, fallbackUrl).toString();
        }

        // Swagger 2.0
        if (spec.host) {
            const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) ? spec.schemes[0] : 'https';
            const basePath = spec.basePath || '';
            return `${scheme}://${spec.host}${basePath}`;
        }

        // Fallback
        return new URL(fallbackUrl).origin;
    } catch {
        try {
            return new URL(fallbackUrl).origin;
        } catch {
            return fallbackUrl;
        }
    }
}

export function buildTargetUrl(baseUrl: string, targetPath: string): string {
    const cleanBase = baseUrl.trim().replace(/\/+$/, '');
    const cleanPath = targetPath.trim().replace(/^\/+/, '');
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
}
