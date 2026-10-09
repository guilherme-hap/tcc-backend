import pkgSpectralCore from '@stoplight/spectral-core';
import { oas } from '@stoplight/spectral-rulesets';
import type { ISpectralCatalogRule, OasVersion } from '../interfaces/evaluation.interface.js';
import type { Severity } from '../types/severity.js';

const { Spectral } = pkgSpectralCore;

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

export function createOasSpectral(rulesConfig: Record<string, boolean> = {}) {
    const rules: Record<string, any> = {};
    for (const [name, enabled] of Object.entries(rulesConfig)) {
        rules[name] = enabled ? true : 'off';
    }

    const spectral = new Spectral();
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
            documentationUrl: rule.documentationUrl,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return catalog;
}

export function isSpectralRule(name: string): boolean {
    return listSpectralRules().some((rule) => rule.name === name);
}
