import pkgSpectralCore from '@stoplight/spectral-core';
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import { oas } from '@stoplight/spectral-rulesets';
import type { ISpectralIssue } from '../interfaces/evaluation.interface.js';
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
    ): Promise<ISpectralIssue[]> {
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

        const document = new Document(rawString, parser as any, openApiUrl);

        const diagnostics = await spectral.run(document);

        return diagnostics.map(toSpectralIssue);
    }
}
