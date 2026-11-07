import { isRecord } from './fetchOpenApiSpec.js';
import { findMatchingSpecPath } from './findMatchingSpecPath.js';
import { resolveRef } from './specRefs.js';

type CredentialCarrier = { in: 'header' | 'query' | 'cookie'; name: string };

const AUTHORIZATION_SCHEME_TYPES = new Set(['http', 'basic', 'oauth2', 'openIdConnect']);
const GENERIC_CREDENTIAL_HEADERS = ['authorization', 'proxy-authorization', 'cookie'];

export function requiresAuthentication(spec: any, operation: any): boolean {
    const security = operation.security ?? spec.security;

    return Array.isArray(security)
        && security.length > 0
        && security.every((requirement) => isRecord(requirement) && Object.keys(requirement).length > 0);
}

function carrierOf(spec: any, name: string): CredentialCarrier | null {
    const declared = spec.components?.securitySchemes ?? spec.securityDefinitions;
    const scheme = resolveRef(spec, isRecord(declared) ? declared[name] : undefined);
    if (!isRecord(scheme)) return null;

    if (scheme.type === 'apiKey' && typeof scheme.name === 'string' && ['header', 'query', 'cookie'].includes(scheme.in)) {
        return { in: scheme.in, name: scheme.name.toLowerCase() };
    }
    if (AUTHORIZATION_SCHEME_TYPES.has(scheme.type)) {
        return { in: 'header', name: 'authorization' };
    }
    return null;
}

export function missingCredentialSchemes(
    spec: any,
    targetPath: string,
    method: string,
    targetUrl: string,
    headers: Record<string, string> = {},
): string[] | null {
    const specPath = findMatchingSpecPath(targetPath, spec);
    const operation = specPath ? spec.paths[specPath]?.[method.toLowerCase()] : undefined;
    if (!isRecord(operation) || !requiresAuthentication(spec, operation)) return null;

    const security: Record<string, unknown>[] = operation.security ?? spec.security;
    const schemes = [...new Set(security.flatMap((requirement) => Object.keys(requirement)))];
    const carriers = schemes.map((name) => carrierOf(spec, name));
    if (carriers.some((carrier) => carrier === null)) return null;

    const sentHeaders = new Set(Object.keys(headers).map((name) => name.toLowerCase()));
    if (GENERIC_CREDENTIAL_HEADERS.some((name) => sentHeaders.has(name))) return null;

    const query = new URL(targetUrl).searchParams;
    const sent = (carriers as CredentialCarrier[]).some((carrier) => {
        if (carrier.in === 'query') return [...query.keys()].some((key) => key.toLowerCase() === carrier.name);
        if (carrier.in === 'cookie') return sentHeaders.has('cookie');
        return sentHeaders.has(carrier.name);
    });
    return sent ? null : schemes;
}
