import axios from 'axios';
import type {
    SecurityCheckCategory,
    SecurityCheckStatus,
    SecurityCheckResult,
    SecurityEvaluationResult,
} from '../interfaces/security.interface.js';
import { calculateSecurityScore } from '../utils/calculateSecurityScore.js';

interface HeaderCheckDefinition {
    header: string;
    category: SecurityCheckCategory;
    weight: number;
    warnScore: number | null;
    evaluate: (headers: Record<string, string>, baseUrl: string) => {
        status: SecurityCheckStatus;
        earnedScore: number;
        actualValue: string | null;
        message: string;
        expected: string;
        recommendation: string;
    };
}

const HEADER_CHECKS: HeaderCheckDefinition[] = [
    {
        header: 'HTTPS',
        category: 'TRANSPORT',
        weight: 10,
        warnScore: null,
        evaluate: (_headers, baseUrl) => {
            const isHttps = baseUrl.toLowerCase().startsWith('https://');
            return {
                status: isHttps ? 'PASS' : 'FAIL',
                earnedScore: isHttps ? 10 : 0,
                actualValue: new URL(baseUrl).protocol,
                expected: 'https://',
                message: isHttps
                    ? 'Connection uses HTTPS'
                    : 'Connection does not use HTTPS',
                recommendation: isHttps
                    ? 'No action required'
                    : 'Migrate the API to use HTTPS with a valid TLS certificate',
            };
        },
    },
    {
        header: 'Strict-Transport-Security',
        category: 'TRANSPORT',
        weight: 20,
        warnScore: 10,
        evaluate: (headers) => {
            const value = headers['strict-transport-security'] ?? null;
            if (!value) {
                return {
                    status: 'FAIL',
                    earnedScore: 0,
                    actualValue: null,
                    expected: 'max-age=<seconds>; includeSubDomains',
                    message: 'Strict-Transport-Security header is missing',
                    recommendation: 'Add the Strict-Transport-Security header with max-age of at least 31536000 and includeSubDomains',
                };
            }
            const hasMaxAge = /max-age=\d+/i.test(value);
            if (hasMaxAge) {
                return {
                    status: 'PASS',
                    earnedScore: 20,
                    actualValue: value,
                    expected: 'max-age=<seconds>; includeSubDomains',
                    message: 'HSTS is properly configured',
                    recommendation: 'No action required',
                };
            }
            return {
                status: 'WARN',
                earnedScore: 10,
                actualValue: value,
                expected: 'max-age=<seconds>; includeSubDomains',
                message: 'HSTS header is present but misconfigured (missing or invalid max-age)',
                recommendation: 'Ensure the header includes a valid max-age directive',
            };
        },
    },

    {
        header: 'Content-Security-Policy',
        category: 'INJECTION_FRAMING',
        weight: 15,
        warnScore: 7.5,
        evaluate: (headers) => {
            const value = headers['content-security-policy'] ?? null;
            if (!value) {
                return {
                    status: 'FAIL',
                    earnedScore: 0,
                    actualValue: null,
                    expected: 'A valid Content-Security-Policy directive',
                    message: 'Content-Security-Policy header is missing',
                    recommendation: 'Add a Content-Security-Policy header with restrictive directives (e.g. default-src \'self\')',
                };
            }
            const isTooPermissive = /default-src\s+\*/i.test(value) || value.trim().length === 0;
            if (isTooPermissive) {
                return {
                    status: 'WARN',
                    earnedScore: 7.5,
                    actualValue: value,
                    expected: 'A restrictive Content-Security-Policy',
                    message: 'CSP is present but overly permissive',
                    recommendation: 'Restrict the CSP directives to only necessary sources',
                };
            }
            return {
                status: 'PASS',
                earnedScore: 15,
                actualValue: value,
                expected: 'A valid Content-Security-Policy directive',
                message: 'Content-Security-Policy is properly configured',
                recommendation: 'No action required',
            };
        },
    },
    {
        header: 'X-Content-Type-Options',
        category: 'INJECTION_FRAMING',
        weight: 10,
        warnScore: 5,
        evaluate: (headers) => {
            const value = headers['x-content-type-options'] ?? null;
            if (!value) {
                return {
                    status: 'FAIL',
                    earnedScore: 0,
                    actualValue: null,
                    expected: 'nosniff',
                    message: 'X-Content-Type-Options header is missing',
                    recommendation: 'Add the X-Content-Type-Options header with value "nosniff"',
                };
            }
            if (value.toLowerCase().trim() === 'nosniff') {
                return {
                    status: 'PASS',
                    earnedScore: 10,
                    actualValue: value,
                    expected: 'nosniff',
                    message: 'X-Content-Type-Options is correctly set to nosniff',
                    recommendation: 'No action required',
                };
            }
            return {
                status: 'WARN',
                earnedScore: 5,
                actualValue: value,
                expected: 'nosniff',
                message: `X-Content-Type-Options is present but has unexpected value: "${value}"`,
                recommendation: 'Set the X-Content-Type-Options header value to "nosniff"',
            };
        },
    },
    {
        header: 'X-Frame-Options',
        category: 'INJECTION_FRAMING',
        weight: 5,
        warnScore: 2.5,
        evaluate: (headers) => {
            const value = headers['x-frame-options'] ?? null;
            if (!value) {
                return {
                    status: 'FAIL',
                    earnedScore: 0,
                    actualValue: null,
                    expected: 'DENY or SAMEORIGIN',
                    message: 'X-Frame-Options header is missing',
                    recommendation: 'Add the X-Frame-Options header with value "DENY" or "SAMEORIGIN"',
                };
            }
            const normalized = value.toUpperCase().trim();
            if (normalized === 'DENY' || normalized === 'SAMEORIGIN') {
                return {
                    status: 'PASS',
                    earnedScore: 5,
                    actualValue: value,
                    expected: 'DENY or SAMEORIGIN',
                    message: `X-Frame-Options is correctly set to ${normalized}`,
                    recommendation: 'No action required',
                };
            }
            return {
                status: 'WARN',
                earnedScore: 2.5,
                actualValue: value,
                expected: 'DENY or SAMEORIGIN',
                message: `X-Frame-Options is present but has a non-standard value: "${value}"`,
                recommendation: 'Set the X-Frame-Options header to "DENY" or "SAMEORIGIN"',
            };
        },
    },

    {
        header: 'Access-Control-Allow-Origin',
        category: 'ACCESS_CONTROL',
        weight: 20,
        warnScore: 10,
        evaluate: (headers) => {
            const value = headers['access-control-allow-origin'] ?? null;
            if (!value) {
                return {
                    status: 'FAIL',
                    earnedScore: 0,
                    actualValue: null,
                    expected: 'A specific origin or restrictive CORS policy',
                    message: 'Access-Control-Allow-Origin header is missing',
                    recommendation: 'Configure CORS to return a specific allowed origin',
                };
            }
            if (value.trim() === '*') {
                return {
                    status: 'WARN',
                    earnedScore: 10,
                    actualValue: value,
                    expected: 'A specific origin',
                    message: 'CORS is configured with wildcard (*), which is permissive',
                    recommendation: 'Restrict allowed origins to specific domains when compatible with your API scenario',
                };
            }
            return {
                status: 'PASS',
                earnedScore: 20,
                actualValue: value,
                expected: 'A specific origin or restrictive CORS policy',
                message: 'CORS is configured with a specific origin',
                recommendation: 'No action required',
            };
        },
    },

    {
        header: 'Server',
        category: 'INFO_LEAKAGE',
        weight: 10,
        warnScore: null,
        evaluate: (headers) => {
            const value = headers['server'] ?? null;
            if (!value) {
                return {
                    status: 'PASS',
                    earnedScore: 10,
                    actualValue: null,
                    expected: 'Header absent',
                    message: 'Server header is not exposed',
                    recommendation: 'No action required',
                };
            }
            return {
                status: 'FAIL',
                earnedScore: 0,
                actualValue: value,
                expected: 'Header absent',
                message: `Server header exposes technology information: "${value}"`,
                recommendation: 'Remove or suppress the Server header to avoid exposing server technology details',
            };
        },
    },
    {
        header: 'X-Powered-By',
        category: 'INFO_LEAKAGE',
        weight: 10,
        warnScore: null,
        evaluate: (headers) => {
            const value = headers['x-powered-by'] ?? null;
            if (!value) {
                return {
                    status: 'PASS',
                    earnedScore: 10,
                    actualValue: null,
                    expected: 'Header absent',
                    message: 'X-Powered-By header is not exposed',
                    recommendation: 'No action required',
                };
            }
            return {
                status: 'FAIL',
                earnedScore: 0,
                actualValue: value,
                expected: 'Header absent',
                message: `X-Powered-By header exposes framework information: "${value}"`,
                recommendation: 'Remove the X-Powered-By header (e.g. app.disable("x-powered-by") in Express)',
            };
        },
    },
];

export class SecurityService {
    public async evaluate(baseUrl: string): Promise<SecurityEvaluationResult> {
        const headers = await this.probeHeaders(baseUrl);
        const normalizedHeaders = this.normalizeHeaders(headers);

        const details: SecurityCheckResult[] = HEADER_CHECKS.map((check) => {
            const result = check.evaluate(normalizedHeaders, baseUrl);
            return {
                header: check.header,
                category: check.category,
                status: result.status,
                weight: check.weight,
                earnedScore: result.earnedScore,
                expected: result.expected,
                actualValue: result.actualValue,
                message: result.message,
                recommendation: result.recommendation,
            };
        });

        const score = calculateSecurityScore(details);
        const passedChecks = details.filter((d) => d.status === 'PASS').length;
        const failedChecks = details.filter((d) => d.status === 'FAIL').length;
        const warningChecks = details.filter((d) => d.status === 'WARN').length;

        let overallStatus: SecurityCheckResult['status'];
        if (failedChecks === 0 && warningChecks === 0) {
            overallStatus = 'PASS';
        } else if (failedChecks === 0) {
            overallStatus = 'WARN';
        } else {
            overallStatus = 'FAIL';
        }

        return {
            score,
            status: overallStatus,
            totalChecks: details.length,
            passedChecks,
            failedChecks,
            warningChecks,
            details,
        };
    }

    private async probeHeaders(baseUrl: string): Promise<Record<string, string>> {
        try {
            const response = await axios.head(baseUrl, {
                timeout: 15_000,
                validateStatus: () => true,
            });
            return response.headers as Record<string, string>;
        } catch {
            const response = await axios.get(baseUrl, {
                timeout: 15_000,
                validateStatus: () => true,
            });
            return response.headers as Record<string, string>;
        }
    }

    private normalizeHeaders(headers: Record<string, any>): Record<string, string> {
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(headers)) {
            normalized[key.toLowerCase()] = String(value);
        }
        return normalized;
    }
}
