import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { auditMessage, IAuditMessage } from '../messages/catalog.js';

export interface ISecurityCheckResult extends IAuditMessage {
    header: string;
    status: 'pass' | 'warning' | 'missing' | 'error';
}

const REQUEST_TIMEOUT_MS = 10_000;

export class SecurityService {
    public async analyze(targetUrl: string): Promise<ISecurityCheckResult[]> {
        const response = await this.fetchHeaders(targetUrl);
        const headers = response.headers as Record<string, string | undefined>;

        return [
            this.checkStrictTransportSecurity(headers),
            this.checkContentSecurityPolicy(headers),
            this.checkXContentTypeOptions(headers),
            this.checkAccessControlAllowOrigin(headers),
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

    private checkStrictTransportSecurity(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const header = 'Strict-Transport-Security';
        const value = this.getHeader(headers, 'strict-transport-security');

        if (!value) {
            return { header, status: 'missing', ...auditMessage('SEC_HSTS_MISSING') };
        }

        const maxAgeMatch = value.match(/max-age\s*=\s*(\d+)/i);
        if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1], 10);
            if (maxAge < 15_768_000) {
                return { header, status: 'warning', ...auditMessage('SEC_HSTS_SHORT_MAX_AGE', { maxAge }) };
            }
        }

        return { header, status: 'pass', ...auditMessage('SEC_HSTS_OK') };
    }

    private checkContentSecurityPolicy(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const header = 'Content-Security-Policy';
        const value = this.getHeader(headers, 'content-security-policy');

        if (!value) {
            return { header, status: 'missing', ...auditMessage('SEC_CSP_MISSING') };
        }

        const hasUnsafeInline = /unsafe-inline/i.test(value);
        const hasWildcard = this.cspContainsWildcardDirective(value);

        if (hasUnsafeInline || hasWildcard) {
            const issues: string[] = [];
            if (hasUnsafeInline) issues.push('unsafe-inline');
            if (hasWildcard) issues.push('* (wildcard)');
            return {
                header,
                status: 'warning',
                ...auditMessage('SEC_CSP_WEAK_DIRECTIVES', { directives: issues.join(', ') }),
            };
        }

        return { header, status: 'pass', ...auditMessage('SEC_CSP_OK') };
    }

    private cspContainsWildcardDirective(cspValue: string): boolean {
        const directives = cspValue.split(';');
        for (const directive of directives) {
            const tokens = directive.trim().split(/\s+/);
            for (let i = 1; i < tokens.length; i++) {
                if (tokens[i] === '*') return true;
            }
        }
        return false;
    }

    private checkXContentTypeOptions(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const header = 'X-Content-Type-Options';
        const value = this.getHeader(headers, 'x-content-type-options');

        if (!value) {
            return { header, status: 'missing', ...auditMessage('SEC_XCTO_MISSING') };
        }

        if (value.trim().toLowerCase() !== 'nosniff') {
            return { header, status: 'warning', ...auditMessage('SEC_XCTO_INVALID', { value }) };
        }

        return { header, status: 'pass', ...auditMessage('SEC_XCTO_OK') };
    }

    private checkAccessControlAllowOrigin(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const header = 'Access-Control-Allow-Origin';
        const value = this.getHeader(headers, 'access-control-allow-origin');

        if (!value) {
            return { header, status: 'pass', ...auditMessage('SEC_CORS_NOT_CONFIGURED') };
        }

        if (value.trim() === '*') {
            const credentials = this.getHeader(headers, 'access-control-allow-credentials');
            if (credentials && credentials.trim().toLowerCase() === 'true') {
                return { header, status: 'error', ...auditMessage('SEC_CORS_WILDCARD_WITH_CREDENTIALS') };
            }

            return { header, status: 'warning', ...auditMessage('SEC_CORS_WILDCARD') };
        }

        return { header, status: 'pass', ...auditMessage('SEC_CORS_EXPLICIT_ORIGIN', { origin: value }) };
    }

    private checkServerHeader(headers: Record<string, string | undefined>): ISecurityCheckResult {
        return this.checkFingerprintHeader(headers, 'Server', 'server');
    }

    private checkXPoweredBy(headers: Record<string, string | undefined>): ISecurityCheckResult {
        return this.checkFingerprintHeader(headers, 'X-Powered-By', 'x-powered-by');
    }

    private checkFingerprintHeader(
        headers: Record<string, string | undefined>,
        displayName: string,
        headerKey: string,
    ): ISecurityCheckResult {
        const header = displayName;
        const value = this.getHeader(headers, headerKey);

        if (!value) {
            return { header, status: 'pass', ...auditMessage('SEC_FINGERPRINT_ABSENT', { header }) };
        }

        if (/\d+\.\d+/.test(value)) {
            return { header, status: 'warning', ...auditMessage('SEC_FINGERPRINT_VERSION_EXPOSED', { header, value }) };
        }

        return { header, status: 'pass', ...auditMessage('SEC_FINGERPRINT_PRESENT', { header, value }) };
    }

    private getHeader(headers: Record<string, string | undefined>, name: string): string | undefined {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : undefined;
    }
}
