import net from 'node:net';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { auditMessage } from '../messages/catalog.js';
import type { ISecurityCheckResult } from '../interfaces/evaluation.interface.js';

type Headers = Record<string, string | undefined>;

const REQUEST_TIMEOUT_MS = 10_000;
const REDIRECT_PROBE_TIMEOUT_MS = 5_000;
const CONNECT_PROBE_TIMEOUT_MS = 3_000;
const CORS_PROBE_TIMEOUT_MS = 10_000;
const FORGED_ORIGIN = 'https://origem-forjada.auditor.invalid';

export class SecurityService {
    public async analyze(targetUrl: string): Promise<ISecurityCheckResult[]> {
        const response = await this.fetchHeaders(targetUrl);
        const headers = response.headers as Headers;
        const responseUrl: string = response.request?.res?.responseUrl ?? targetUrl;

        const [redirect, cors] = await Promise.all([
            this.checkHttpsRedirect(targetUrl),
            this.checkCors(targetUrl),
        ]);

        return [
            this.checkHttps(targetUrl),
            redirect,
            this.checkStrictTransportSecurity(headers, new URL(responseUrl).protocol === 'https:'),
            cors,
            this.checkXContentTypeOptions(headers),
            this.checkFramingProtection(headers),
            this.checkServerHeader(headers),
            this.checkXPoweredBy(headers),
        ];
    }

    private async fetchHeaders(targetUrl: string): Promise<AxiosResponse> {
        try {
            const headResponse = await axios.head(targetUrl, { timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true });
            if (headResponse.status !== 405) {
                return headResponse;
            }
        } catch {
        }
        return await axios.get(targetUrl, { timeout: REQUEST_TIMEOUT_MS, validateStatus: () => true });
    }

    private async probeRequest(
        url: string,
        options: { timeout: number; maxRedirects?: number; headers?: Record<string, string> },
    ): Promise<AxiosResponse> {
        const config = { ...options, validateStatus: () => true };
        const headResponse = await axios.head(url, config);
        if (headResponse.status !== 405) {
            return headResponse;
        }
        return await axios.get(url, config);
    }

    private checkHttps(targetUrl: string): ISecurityCheckResult {
        const header = 'HTTPS';
        const layer = 'transport';

        const url = new URL(targetUrl);
        if (url.protocol !== 'https:') {
            return this.isLocalAddress(url)
                ? { layer, header, status: 'error', ...auditMessage('SEC_TRANSPORT_NOT_HTTPS_LOCAL', { host: url.hostname }) }
                : { layer, header, status: 'error', ...auditMessage('SEC_TRANSPORT_NOT_HTTPS') };
        }

        return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_HTTPS_OK') };
    }

    private async checkHttpsRedirect(targetUrl: string): Promise<ISecurityCheckResult> {
        const header = 'HTTP-to-HTTPS Redirect';
        const layer = 'transport';

        const probeUrl = new URL(targetUrl);
        const probesTlsPort = probeUrl.protocol === 'https:' && probeUrl.port !== '';
        probeUrl.protocol = 'http:';

        try {
            const response = await this.probeRequest(probeUrl.toString(), {
                timeout: REDIRECT_PROBE_TIMEOUT_MS,
                maxRedirects: 0,
            });
            const status = response.status;

            if (status >= 300 && status < 400) {
                const location = this.getHeader(response.headers as Headers, 'location')?.trim();
                if (location && /^https:\/\//i.test(location)) {
                    return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_REDIRECT_OK') };
                }
                return {
                    layer,
                    header,
                    status: 'error',
                    ...auditMessage('SEC_TRANSPORT_REDIRECT_NOT_HTTPS', { status, location: location || '(ausente)' }),
                };
            }

            if (status === 426 || (status === 400 && probesTlsPort)) {
                return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_HTTP_REFUSED') };
            }

            return { layer, header, status: 'error', ...auditMessage('SEC_TRANSPORT_HTTP_SERVED', { status }) };
        } catch (error) {
            const code = axios.isAxiosError(error) ? error.code : undefined;
            if (code === 'ETIMEDOUT') {
                return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_HTTP_TIMEOUT') };
            }
            if (code !== 'ECONNABORTED') {
                return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_HTTP_REFUSED') };
            }
            if (await this.acceptsConnection(probeUrl)) {
                return { layer, header, status: 'warning', ...auditMessage('SEC_TRANSPORT_HTTP_NO_RESPONSE') };
            }
            return { layer, header, status: 'pass', ...auditMessage('SEC_TRANSPORT_HTTP_TIMEOUT') };
        }
    }

    private acceptsConnection(url: URL): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = net.connect({
                host: this.bareHostname(url),
                port: Number(url.port) || 80,
                timeout: CONNECT_PROBE_TIMEOUT_MS,
            });
            const finish = (connected: boolean) => {
                socket.destroy();
                resolve(connected);
            };
            socket.once('connect', () => finish(true));
            socket.once('timeout', () => finish(false));
            socket.once('error', () => finish(false));
        });
    }

    private bareHostname(url: URL): string {
        const hostname = url.hostname.toLowerCase();
        return hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
    }

    private isLocalAddress(url: URL): boolean {
        const hostname = this.bareHostname(url);
        if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1') {
            return true;
        }
        if (net.isIPv4(hostname)) {
            const [first, second] = hostname.split('.').map(Number);
            return first === 127
                || first === 10
                || (first === 172 && second >= 16 && second <= 31)
                || (first === 192 && second === 168);
        }
        return false;
    }

    private checkStrictTransportSecurity(headers: Headers, receivedOverHttps: boolean): ISecurityCheckResult {
        const header = 'Strict-Transport-Security';
        const layer = 'transport';

        if (!receivedOverHttps) {
            return { layer, header, status: 'missing', ...auditMessage('SEC_HSTS_REQUIRES_HTTPS') };
        }

        const value = this.getHeader(headers, 'strict-transport-security');

        if (!value) {
            return { layer, header, status: 'missing', ...auditMessage('SEC_HSTS_MISSING') };
        }

        const maxAgeMatch = value.match(/max-age\s*=\s*(\d+)/i);
        if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1], 10);
            if (maxAge < 15_768_000) {
                return { layer, header, status: 'warning', ...auditMessage('SEC_HSTS_SHORT_MAX_AGE', { maxAge }) };
            }
        }

        return { layer, header, status: 'pass', ...auditMessage('SEC_HSTS_OK') };
    }

    private async checkCors(targetUrl: string): Promise<ISecurityCheckResult> {
        const header = 'Access-Control-Allow-Origin';
        const layer = 'access';

        let headers: Headers;
        try {
            const response = await this.probeRequest(targetUrl, {
                timeout: CORS_PROBE_TIMEOUT_MS,
                headers: { Origin: FORGED_ORIGIN },
            });
            headers = response.headers as Headers;
        } catch {
            return { layer, header, status: 'error', ...auditMessage('SEC_CORS_PROBE_FAILED') };
        }

        const allowOrigin = this.getHeader(headers, 'access-control-allow-origin')?.trim();
        if (!allowOrigin) {
            return { layer, header, status: 'pass', ...auditMessage('SEC_CORS_NOT_CONFIGURED') };
        }

        const allowCredentials = this.getHeader(headers, 'access-control-allow-credentials')?.trim().toLowerCase() === 'true';

        if (allowOrigin === '*') {
            return allowCredentials
                ? { layer, header, status: 'warning', ...auditMessage('SEC_CORS_WILDCARD_WITH_CREDENTIALS') }
                : { layer, header, status: 'pass', ...auditMessage('SEC_CORS_WILDCARD') };
        }

        if (allowOrigin.toLowerCase() === 'null' && allowCredentials) {
            return { layer, header, status: 'error', ...auditMessage('SEC_CORS_NULL_ORIGIN_WITH_CREDENTIALS') };
        }

        if (allowOrigin.toLowerCase() === FORGED_ORIGIN) {
            return allowCredentials
                ? { layer, header, status: 'error', ...auditMessage('SEC_CORS_REFLECTED_ORIGIN', { origin: FORGED_ORIGIN }) }
                : {
                    layer,
                    header,
                    status: 'pass',
                    ...auditMessage('SEC_CORS_REFLECTED_ORIGIN_NO_CREDENTIALS', { origin: FORGED_ORIGIN }),
                };
        }

        return { layer, header, status: 'pass', ...auditMessage('SEC_CORS_EXPLICIT_ORIGIN', { origin: allowOrigin }) };
    }

    private checkXContentTypeOptions(headers: Headers): ISecurityCheckResult {
        const header = 'X-Content-Type-Options';
        const layer = 'content';
        const value = this.getHeader(headers, 'x-content-type-options');

        if (!value) {
            return { layer, header, status: 'missing', ...auditMessage('SEC_XCTO_MISSING') };
        }

        if (value.trim().toLowerCase() !== 'nosniff') {
            return { layer, header, status: 'warning', ...auditMessage('SEC_XCTO_INVALID', { value }) };
        }

        return { layer, header, status: 'pass', ...auditMessage('SEC_XCTO_OK') };
    }

    private checkFramingProtection(headers: Headers): ISecurityCheckResult {
        const header = 'Content-Security-Policy / X-Frame-Options';
        const layer = 'content';

        const csp = this.getHeader(headers, 'content-security-policy');
        const frameAncestors = csp ? this.extractFrameAncestors(csp) : undefined;

        if (frameAncestors !== undefined) {
            const source = 'Content-Security-Policy (frame-ancestors)';
            const value = `frame-ancestors ${frameAncestors}`.trim();
            const tokens = frameAncestors.split(/\s+/).filter(Boolean);
            if (tokens.length === 0 || tokens.includes('*')) {
                return { layer, header, status: 'warning', ...auditMessage('SEC_FRAMING_WEAK', { source, value }) };
            }
            return { layer, header, status: 'pass', ...auditMessage('SEC_FRAMING_OK', { source, value }) };
        }

        const frameOptions = this.getHeader(headers, 'x-frame-options');
        if (frameOptions) {
            const source = 'X-Frame-Options';
            const value = frameOptions.trim();
            const directive = value.split(',')[0].trim().toUpperCase();
            if (directive === 'DENY' || directive === 'SAMEORIGIN') {
                return { layer, header, status: 'pass', ...auditMessage('SEC_FRAMING_OK', { source, value }) };
            }
            return { layer, header, status: 'warning', ...auditMessage('SEC_FRAMING_WEAK', { source, value }) };
        }

        return { layer, header, status: 'missing', ...auditMessage('SEC_FRAMING_MISSING') };
    }

    private extractFrameAncestors(cspValue: string): string | undefined {
        for (const directive of cspValue.split(';')) {
            const [name, ...sources] = directive.trim().split(/\s+/);
            if (name?.toLowerCase() === 'frame-ancestors') {
                return sources.join(' ');
            }
        }
        return undefined;
    }

    private checkServerHeader(headers: Headers): ISecurityCheckResult {
        return this.checkFingerprintHeader(headers, 'Server', 'server');
    }

    private checkXPoweredBy(headers: Headers): ISecurityCheckResult {
        return this.checkFingerprintHeader(headers, 'X-Powered-By', 'x-powered-by');
    }

    private checkFingerprintHeader(headers: Headers, displayName: string, headerKey: string): ISecurityCheckResult {
        const header = displayName;
        const layer = 'leakage';
        const value = this.getHeader(headers, headerKey);

        if (!value) {
            return { layer, header, status: 'pass', ...auditMessage('SEC_FINGERPRINT_ABSENT', { header }) };
        }

        if (/\d+\.\d+/.test(value)) {
            return { layer, header, status: 'warning', ...auditMessage('SEC_FINGERPRINT_VERSION_EXPOSED', { header, value }) };
        }

        return { layer, header, status: 'pass', ...auditMessage('SEC_FINGERPRINT_PRESENT', { header, value }) };
    }

    private getHeader(headers: Headers, name: string): string | undefined {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : undefined;
    }
}
