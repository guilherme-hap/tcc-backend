import pkgSpectralCore from '@stoplight/spectral-core';
import pkgSpectralRefResolver from '@stoplight/spectral-ref-resolver';
import { oas } from '@stoplight/spectral-rulesets';
import { AppError } from '../errors/AppError.js';
import type { ISpectralCatalogRule, OasVersion } from '../interfaces/evaluation.interface.js';
import type { Severity } from '../types/severity.js';
import { createFetchDeadline, describeFetchError, fetchRemoteText } from './fetchRemoteText.js';

const { Spectral } = pkgSpectralCore;
const { Resolver } = pkgSpectralRefResolver;

export const SEVERITY_BY_LEVEL: Record<number, Severity> = {
    0: 'Error',
    1: 'Warning',
    2: 'Info',
    3: 'Hint',
};

const OAS_VERSION_SAMPLES: Record<OasVersion, object> = {
    '2.0': { swagger: '2.0' },
    '3.0': { openapi: '3.0.0' },
    '3.1': { openapi: '3.1.0' },
};

const OAS_VERSIONS = Object.keys(OAS_VERSION_SAMPLES) as OasVersion[];

const OPENAPI_RULES_PAGE = 'https://meta.stoplight.io/docs/spectral/4dec24461f3af-open-api-rules';

function documentationUrlOf(rule: { name: string; documentationUrl?: string | null }): string | null {
    if (!rule.documentationUrl) return null;

    return `${OPENAPI_RULES_PAGE}#${rule.name.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
}

function createRefResolver() {
    let deadline: AbortSignal | undefined;

    const resolve = async (ref: { href(): string }): Promise<string> => {
        const url = ref.href();
        deadline ??= createFetchDeadline();
        try {
            return await fetchRemoteText(url, deadline);
        } catch (err: unknown) {
            throw new AppError('SPEC_REF_FETCH_FAILED', { url, reason: describeFetchError(err) });
        }
    };

    return new Resolver({ resolvers: { http: { resolve }, https: { resolve } } });
}

export function createOasSpectral(rulesConfig: Record<string, boolean> = {}) {
    const rules: Record<string, any> = {};
    for (const [name, enabled] of Object.entries(rulesConfig)) {
        rules[name] = enabled ? true : 'off';
    }

    const spectral = new Spectral({ resolver: createRefResolver() });
    spectral.setRuleset({
        extends: [
            [oas as any, 'recommended'],
        ],
        rules,
    });
    return spectral;
}

let catalog: ISpectralCatalogRule[] | undefined;

export function listSpectralRules(): ISpectralCatalogRule[] {
    catalog ??= Object.values(createOasSpectral().ruleset!.rules)
        .map((rule) => ({
            name: rule.name,
            description: rule.description || null,
            severity: SEVERITY_BY_LEVEL[rule.severity] ?? 'Unknown',
            enabledByDefault: rule.enabled,
            oasVersions: OAS_VERSIONS.filter((version) =>
                !rule.formats || [...rule.formats].some((format) => format(OAS_VERSION_SAMPLES[version], null))),
            documentationUrl: documentationUrlOf(rule),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return catalog;
}

export function isSpectralRule(name: string): boolean {
    return listSpectralRules().some((rule) => rule.name === name);
}
