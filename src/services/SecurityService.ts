import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { Severity } from '../types/severity.js';

export interface ISecurityCheckResult {
    header: string;
    status: 'pass' | 'warning' | 'missing' | 'error';
    severity: Severity;
    message: string;
    recommendation?: string;
}

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
            const headResponse = await axios.head(targetUrl, { validateStatus: () => true });
            if (headResponse.status !== 405) {
                return headResponse;
            }
        } catch {
        }
        return await axios.get(targetUrl, { validateStatus: () => true });
    }

    private checkStrictTransportSecurity(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const value = this.getHeader(headers, 'strict-transport-security');

        if (!value) {
            return {
                header: 'Strict-Transport-Security',
                status: 'missing',
                severity: 'Warning',
                message: 'O header Strict-Transport-Security (HSTS) não está presente.',
                recommendation: 'Adicione o header com max-age de pelo menos 6 meses (15768000 segundos). Exemplo: Strict-Transport-Security: max-age=31536000; includeSubDomains.',
            };
        }

        const maxAgeMatch = value.match(/max-age\s*=\s*(\d+)/i);
        if (maxAgeMatch) {
            const maxAge = parseInt(maxAgeMatch[1], 10);
            if (maxAge < 15_768_000) {
                return {
                    header: 'Strict-Transport-Security',
                    status: 'warning',
                    severity: 'Info',
                    message: `HSTS presente, mas max-age (${maxAge}s) é inferior a 6 meses (15768000s).`,
                    recommendation: 'Aumente o max-age para pelo menos 15768000 (6 meses), idealmente 31536000 (1 ano).',
                };
            }
        }

        return {
            header: 'Strict-Transport-Security',
            status: 'pass',
            severity: 'Info',
            message: 'HSTS configurado corretamente.',
        };
    }

    private checkContentSecurityPolicy(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const value = this.getHeader(headers, 'content-security-policy');

        if (!value) {
            return {
                header: 'Content-Security-Policy',
                status: 'missing',
                severity: 'Info',
                message: 'O header Content-Security-Policy (CSP) não está presente.',
                recommendation: 'Defina uma política CSP restritiva. Para APIs, ao menos: default-src \'none\'.',
            };
        }

        const hasUnsafeInline = /unsafe-inline/i.test(value);
        const hasWildcard = this.cspContainsWildcardDirective(value);

        if (hasUnsafeInline || hasWildcard) {
            const issues: string[] = [];
            if (hasUnsafeInline) issues.push('unsafe-inline');
            if (hasWildcard) issues.push('* (wildcard)');
            return {
                header: 'Content-Security-Policy',
                status: 'warning',
                severity: 'Warning',
                message: `CSP presente, mas contém diretivas fracas: ${issues.join(', ')}.`,
                recommendation: 'Remova unsafe-inline e substitua * por origens explícitas.',
            };
        }

        return {
            header: 'Content-Security-Policy',
            status: 'pass',
            severity: 'Info',
            message: 'CSP configurado sem diretivas inseguras detectadas.',
        };
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
        const value = this.getHeader(headers, 'x-content-type-options');

        if (!value) {
            return {
                header: 'X-Content-Type-Options',
                status: 'missing',
                severity: 'Warning',
                message: 'O header X-Content-Type-Options não está presente.',
                recommendation: 'Adicione o header com o valor "nosniff" para prevenir MIME-type sniffing.',
            };
        }

        if (value.trim().toLowerCase() !== 'nosniff') {
            return {
                header: 'X-Content-Type-Options',
                status: 'warning',
                severity: 'Warning',
                message: `X-Content-Type-Options presente com valor inesperado: "${value}".`,
                recommendation: 'O único valor válido é "nosniff". Corrija o header.',
            };
        }

        return {
            header: 'X-Content-Type-Options',
            status: 'pass',
            severity: 'Info',
            message: 'X-Content-Type-Options configurado como "nosniff".',
        };
    }

    private checkAccessControlAllowOrigin(headers: Record<string, string | undefined>): ISecurityCheckResult {
        const value = this.getHeader(headers, 'access-control-allow-origin');

        if (!value) {
            return {
                header: 'Access-Control-Allow-Origin',
                status: 'pass',
                severity: 'Info',
                message: 'Header Access-Control-Allow-Origin ausente (nenhum CORS configurado — seguro por padrão).',
            };
        }

        if (value.trim() === '*') {
            const credentials = this.getHeader(headers, 'access-control-allow-credentials');
            if (credentials && credentials.trim().toLowerCase() === 'true') {
                return {
                    header: 'Access-Control-Allow-Origin',
                    status: 'error',
                    severity: 'Error',
                    message: 'CORS configurado com Access-Control-Allow-Origin: * e Access-Control-Allow-Credentials: true — combinação insegura e inválida pela especificação.',
                    recommendation: 'Nunca use wildcard (*) com credentials. Especifique origens explícitas ao habilitar credentials.',
                };
            }

            return {
                header: 'Access-Control-Allow-Origin',
                status: 'warning',
                severity: 'Warning',
                message: 'CORS permite qualquer origem (Access-Control-Allow-Origin: *).',
                recommendation: 'Restrinja a origens específicas confiáveis quando possível.',
            };
        }

        return {
            header: 'Access-Control-Allow-Origin',
            status: 'pass',
            severity: 'Info',
            message: `CORS configurado com origem explícita: ${value}.`,
        };
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
        const value = this.getHeader(headers, headerKey);

        if (!value) {
            return {
                header: displayName,
                status: 'pass',
                severity: 'Info',
                message: `Header ${displayName} ausente — bom, reduz fingerprinting.`,
            };
        }

        const hasVersion = /\d+\.\d+/.test(value);

        if (hasVersion) {
            return {
                header: displayName,
                status: 'warning',
                severity: 'Warning',
                message: `Header ${displayName} expõe informação de versão: "${value}".`,
                recommendation: `Remova ou oculte o header ${displayName} para reduzir a superfície de ataque.`,
            };
        }

        return {
            header: displayName,
            status: 'pass',
            severity: 'Info',
            message: `Header ${displayName} presente ("${value}"), mas sem versão detalhada.`,
            recommendation: `Considere remover o header ${displayName} para reduzir fingerprinting.`,
        };
    }

    private getHeader(headers: Record<string, string | undefined>, name: string): string | undefined {
        const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : undefined;
    }
}
