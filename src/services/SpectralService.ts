import pkgSpectralCore from '@stoplight/spectral-core';
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import { oas } from '@stoplight/spectral-rulesets';
import type { ISpectralAnalysis, ISpectralIssue, ISpectralRule } from '../interfaces/evaluation.interface.js';
import type { Severity } from '../types/severity.js';
import { fetchOpenApiContent, ParsedOpenApiContent } from '../utils/fetchOpenApiSpec.js';

const { Spectral, Document } = pkgSpectralCore;
const { Json, Yaml } = pkgSpectralParsers;

const SEVERITY_BY_LEVEL: Record<number, Severity> = {
    0: 'Error',
    1: 'Warning',
    2: 'Info',
    3: 'Hint',
};

function toSpectralIssue(diagnostic: ISpectralDiagnostic): ISpectralIssue {
    const [root, endpoint, method] = diagnostic.path;
    const isPathItem = root === 'paths' && endpoint !== undefined;

    return {
        endpoint: isPathItem ? String(endpoint) : 'global',
        method: isPathItem && method !== undefined ? String(method).toUpperCase() : 'N/A',
        rule: diagnostic.code,
        message: diagnostic.message,
        severity: SEVERITY_BY_LEVEL[diagnostic.severity] ?? 'Unknown',
    };
}

export class SpectralService {
    public async analyze(
        openApiUrl: string,
        rulesConfig: Record<string, boolean> = {},
        preloadedContent?: ParsedOpenApiContent,
    ): Promise<ISpectralAnalysis> {
        const { format, rawString } = preloadedContent ?? (await fetchOpenApiContent(openApiUrl));
        const parser = format === 'yaml' ? Yaml : Json;

        const customRules: Record<string, any> = {};
        for (const [key, value] of Object.entries(rulesConfig)) {
            customRules[key] = value ? true : 'off';
        }

        const spectral = new Spectral();
        spectral.setRuleset({
            extends: [
                [oas as any, 'recommended'],
            ],
            rules: customRules
        });

        const targeted = new Set<string>();
        for (const rule of Object.values(spectral.ruleset!.rules)) {
            for (const then of rule.then) {
                const original = then.function;
                then.function = ((...args: Parameters<typeof original>) => {
                    targeted.add(rule.name);
                    return original(...args);
                }) as typeof original;
            }
        }

        const document = new Document(rawString, parser as any, openApiUrl);

        const diagnostics = await spectral.run(document);

        const formats = document.formats ?? null;
        const rules: ISpectralRule[] = Object.values(spectral.ruleset!.rules)
            .filter((rule) => rule.enabled && rule.matchesFormat(formats) && targeted.has(rule.name))
            .map((rule) => ({
                name: rule.name,
                severity: SEVERITY_BY_LEVEL[rule.severity] ?? 'Unknown',
            }));

        return { issues: diagnostics.map(toSpectralIssue), rules };
    }
}
