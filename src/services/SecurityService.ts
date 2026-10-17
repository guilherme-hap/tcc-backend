import net from 'node:net';
import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { auditMessage, type IAuditMessage } from '../messages/catalog.js';
import { AppError } from '../errors/AppError.js';
import type { ISecurityCheckResult, SecurityLayer } from '../interfaces/evaluation.interface.js';

type Headers = Record<string, string | undefined>;

interface ProbeOptions {
    timeout: number;
    maxRedirects?: number;
    headers?: Record<string, string>;
}

type CorsProbe = { headers: Headers } | { failure: { attempts: number; detail: string } };

const REQUEST_TIMEOUT_MS = 10_000;
const REDIRECT_PROBE_TIMEOUT_MS = 5_000;
const CONNECT_PROBE_TIMEOUT_MS = 3_000;
const CORS_PROBE_TIMEOUT_MS = 10_000;
const CORS_PROBE_ATTEMPTS = 2;
const FORGED_ORIGIN = 'https://origem-forjada.auditor.invalid';

function checkOf(layer: SecurityLayer, header: string) {
    return (status: ISecurityCheckResult['status'], audit: IAuditMessage): ISecurityCheckResult => (
        { layer, header, status, ...audit }
    );
}

export class SecurityService {
    public async analyze(targetUrl: string): Promise<ISecurityCheckResult[]> {
        const response = await this.fetchHeaders(targetUrl);
        const headers = response.headers as Headers;
        const responseUrl: string = response.request?.res?.responseUrl ?? targetUrl;

        const [redirect, cors] = await Promise.all([
            this.checkHttpsRedirect(targetUrl),
            this.checkCors(targetUrl, headers),
        ]);

        return [
            this.checkHttps(targetUrl),
            redirect,
            this.checkStrictTransportSecurity(headers, new URL(responseUrl).protocol === 'https:'),
            cors,
            this.checkXContentTypeOptions(headers),
            this.checkFramingProtection(headers),
            this.checkFingerprintHeader(headers, 'Server'),
            this.checkFingerprintHeader(headers, 'X-Powered-By'),
        ];
    }

    private async fetchHeaders(targetUrl: string): Promise<AxiosResponse> {
        try {
            const headResponse = await this.requestHeaders('HEAD', targetUrl, { timeout: REQUEST_TIMEOUT_MS });
            if (headResponse.status !== 405) {
                return headResponse;
            }
        } catch {
        }
        try {
            return await this.requestHeaders('GET', targetUrl, { timeout: REQUEST_TIMEOUT_MS });
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            throw new AppError('SECURITY_TARGET_UNREACHABLE', { detail });
        }
    }

    private async probeRequest(url: string, options: ProbeOptions): Promise<AxiosResponse> {
        const headResponse = await this.requestHeaders('HEAD', url, options);
        if (headResponse.status !== 405) {
            return headResponse;
        }
        return await this.requestHeaders('GET', url, options);
    }

    private async requestHeaders(method: 'HEAD' | 'GET', url: string, options: ProbeOptions): Promise<AxiosResponse> {
        const response = await axios.request({
            ...options,
            url,
            method,
            responseType: 'stream',
            validateStatus: () => true,
        });
        response.data.destroy();
        return response;
    }

    private checkHttps(targetUrl: string): ISecurityCheckResult {
        const result = checkOf('transport', 'HTTPS');

        const url = new URL(targetUrl);
        if (url.protocol !== 'https:') {
            return this.isLocalAddress(url)
                ? result('error', auditMessage('SEC_TRANSPORT_NOT_HTTPS_LOCAL', { host: url.hostname }))
                : result('error', auditMessage('SEC_TRANSPORT_NOT_HTTPS'));
        }

        return result('pass', auditMessage('SEC_TRANSPORT_HTTPS_OK'));
    }

    private async checkHttpsRedirect(targetUrl: string): Promise<ISecurityCheckResult> {
        const result = checkOf('transport', 'HTTP-to-HTTPS Redirect');

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
                    return result('pass', auditMessage('SEC_TRANSPORT_REDIRECT_OK'));
                }
                return result('error', auditMessage('SEC_TRANSPORT_REDIRECT_NOT_HTTPS', { status, location: location || '(ausente)' }));
            }

            if (status === 426 || (status === 400 && probesTlsPort)) {
                return result('pass', auditMessage('SEC_TRANSPORT_HTTP_REFUSED'));
            }

            return result('error', auditMessage('SEC_TRANSPORT_HTTP_SERVED', { status }));
        } catch (error) {
            const code = axios.isAxiosError(error) ? error.code : undefined;
            if (code === 'ETIMEDOUT') {
                return result('pass', auditMessage('SEC_TRANSPORT_HTTP_TIMEOUT'));
            }
            if (code !== 'ECONNABORTED') {
                return result('pass', auditMessage('SEC_TRANSPORT_HTTP_REFUSED'));
            }
            if (await this.acceptsConnection(probeUrl)) {
                return result('warning', auditMessage('SEC_TRANSPORT_HTTP_NO_RESPONSE'));
            }
            return result('pass', auditMessage('SEC_TRANSPORT_HTTP_TIMEOUT'));
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
        const result = checkOf('transport', 'Strict-Transport-Security');

        if (!receivedOverHttps) {
            return result('missing', auditMessage('SEC_HSTS_REQUIRES_HTTPS'));
        }

        const value = this.getHeader(headers, 'strict-transport-security');

        if (!value) {
            return result('missing', auditMessage('SEC_HSTS_MISSING'));
        }

        const maxAgeMatch = value.match(/max-age\s*=\s*(\d+)/i);
        if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1], 10);
            if (maxAge < 15_768_000) {
                return result('warning', auditMessage('SEC_HSTS_SHORT_MAX_AGE', { maxAge }));
            }
        }

        return result('pass', auditMessage('SEC_HSTS_OK'));
    }

    private async checkCors(targetUrl: string, requestHeaders: Headers): Promise<ISecurityCheckResult> {
        const result = checkOf('access', 'Access-Control-Allow-Origin');

        const probe = await this.probeCors(targetUrl);
        const headers = 'failure' in probe ? requestHeaders : probe.headers;

        const allowOrigin = this.getHeader(headers, 'access-control-allow-origin')?.trim();
        if (!allowOrigin) {
            return 'failure' in probe
                ? result('warning', auditMessage('SEC_CORS_PROBE_UNANSWERED', probe.failure))
                : result('pass', auditMessage('SEC_CORS_NOT_CONFIGURED'));
        }

        const allowCredentials = this.getHeader(headers, 'access-control-allow-credentials')?.trim().toLowerCase() === 'true';

        if (allowOrigin === '*') {
            return allowCredentials
                ? result('warning', auditMessage('SEC_CORS_WILDCARD_WITH_CREDENTIALS'))
                : result('pass', auditMessage('SEC_CORS_WILDCARD'));
        }

        if (allowOrigin.toLowerCase() === 'null' && allowCredentials) {
            return result('error', auditMessage('SEC_CORS_NULL_ORIGIN_WITH_CREDENTIALS'));
        }

        if (allowOrigin.toLowerCase() === FORGED_ORIGIN) {
            return allowCredentials
                ? result('error', auditMessage('SEC_CORS_REFLECTED_ORIGIN', { origin: FORGED_ORIGIN }))
                : result('pass', auditMessage('SEC_CORS_REFLECTED_ORIGIN_NO_CREDENTIALS', { origin: FORGED_ORIGIN }));
        }

        return result('pass', auditMessage('SEC_CORS_EXPLICIT_ORIGIN', { origin: allowOrigin }));
    }

    private async probeCors(targetUrl: string): Promise<CorsProbe> {
        let lastError: unknown;
        for (let attempt = 1; attempt <= CORS_PROBE_ATTEMPTS; attempt++) {
            try {
                const response = await this.probeRequest(targetUrl, {
                    timeout: CORS_PROBE_TIMEOUT_MS,
                    headers: { Origin: FORGED_ORIGIN },
                });
                return { headers: response.headers as Headers };
            } catch (error) {
                lastError = error;
            }
        }
        const detail = lastError instanceof Error ? lastError.message : String(lastError);
        return { failure: { attempts: CORS_PROBE_ATTEMPTS, detail } };
    }

    private checkXContentTypeOptions(headers: Headers): ISecurityCheckResult {
        const result = checkOf('content', 'X-Content-Type-Options');
        const value = this.getHeader(headers, 'x-content-type-options');

        if (!value) {
            return result('missing', auditMessage('SEC_XCTO_MISSING'));
        }

        if (value.trim().toLowerCase() !== 'nosniff') {
            return result('warning', auditMessage('SEC_XCTO_INVALID', { value }));
        }

        return result('pass', auditMessage('SEC_XCTO_OK'));
    }

    private checkFramingProtection(headers: Headers): ISecurityCheckResult {
        const result = checkOf('content', 'Content-Security-Policy / X-Frame-Options');

        const csp = this.getHeader(headers, 'content-security-policy');
        const frameAncestors = csp ? this.extractFrameAncestors(csp) : undefined;

        if (frameAncestors !== undefined) {
            const source = 'Content-Security-Policy (frame-ancestors)';
            const value = `frame-ancestors ${frameAncestors}`.trim();
            const tokens = frameAncestors.split(/\s+/).filter(Boolean);
            if (tokens.length === 0 || tokens.includes('*')) {
                return result('warning', auditMessage('SEC_FRAMING_WEAK', { source, value }));
            }
            return result('pass', auditMessage('SEC_FRAMING_OK', { source, value }));
        }

        const frameOptions = this.getHeader(headers, 'x-frame-options');
        if (frameOptions) {
            const source = 'X-Frame-Options';
            const value = frameOptions.trim();
            const directive = value.split(',')[0].trim().toUpperCase();
            if (directive === 'DENY' || directive === 'SAMEORIGIN') {
                return result('pass', auditMessage('SEC_FRAMING_OK', { source, value }));
            }
            return result('warning', auditMessage('SEC_FRAMING_WEAK', { source, value }));
        }

        return result('missing', auditMessage('SEC_FRAMING_MISSING'));
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

    private checkFingerprintHeader(headers: Headers, header: string): ISecurityCheckResult {
        const result = checkOf('leakage', header);
        const value = this.getHeader(headers, header);

        if (!value) {
            return result('pass', auditMessage('SEC_FINGERPRINT_ABSENT', { header }));
        }

        if (/\d+\.\d+/.test(value)) {
            return result('error', auditMessage('SEC_FINGERPRINT_VERSION_EXPOSED', { header, value }));
        }

        return result('pass', auditMessage('SEC_FINGERPRINT_PRESENT', { header, value }));
    }

    private getHeader(headers: Headers, name: string): string | undefined {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : undefined;
    }
}
