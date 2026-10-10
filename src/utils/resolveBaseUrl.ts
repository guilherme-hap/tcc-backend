function applyServerVariables(serverUrl: string, variables: any): string {
    return serverUrl.replace(/\{([^}]+)\}/g, (placeholder, name: string) => {
        const value = variables?.[name]?.default;
        return value === undefined ? placeholder : String(value);
    });
}

export function resolveBaseUrlFromSpec(spec: any, fallbackUrl: string): string {
    try {
        if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0]?.url) {
            const serverUrl = applyServerVariables(String(spec.servers[0].url).trim(), spec.servers[0].variables);
            if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
                return serverUrl;
            }
            return new URL(serverUrl, fallbackUrl).toString();
        }

        if (spec.host || spec.basePath) {
            const specUrl = new URL(fallbackUrl);
            const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) ? spec.schemes[0] : specUrl.protocol.slice(0, -1);
            const host = spec.host || specUrl.host;
            const basePath = spec.basePath || '';
            return `${scheme}://${host}${basePath}`;
        }

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
