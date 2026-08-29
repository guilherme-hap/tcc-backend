import axios from 'axios';

export async function resolveBaseUrl(swaggerUrl: string): Promise<string> {
    try {
        const response = await axios.get(swaggerUrl);
        const data = response.data;
        const spec = typeof data === 'string' ? JSON.parse(data) : data;

        // OpenAPI 3.x
        if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0 && spec.servers[0]?.url) {
            const serverUrl = String(spec.servers[0].url).trim();
            if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
                return serverUrl;
            }
            return new URL(serverUrl, swaggerUrl).toString();
        }

        // Swagger 2.0
        if (spec.host) {
            const scheme = (Array.isArray(spec.schemes) && spec.schemes[0]) ? spec.schemes[0] : 'https';
            const basePath = spec.basePath || '';
            return `${scheme}://${spec.host}${basePath}`;
        }

        // Fallback
        return new URL(swaggerUrl).origin;
    } catch (error) {
        try {
            return new URL(swaggerUrl).origin;
        } catch {
            return swaggerUrl;
        }
    }
}
