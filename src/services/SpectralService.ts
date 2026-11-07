import pkgSpectralCore from '@stoplight/spectral-core';
import type { ISpectralDiagnostic } from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import type { ISpectralAnalysis, ISpectralIssue, ISpectralRule } from '../interfaces/evaluation.interface.js';
import { fetchOpenApiContent, ParsedOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import { SEVERITY_BY_LEVEL, createOasSpectral } from '../utils/spectralRules.js';

const { Document } = pkgSpectralCore;
const { Json, Yaml } = pkgSpectralParsers;

const SCHEMA_RULES = new Set(['oas2-schema', 'oas3-schema']);
const ONE_OF_SUMMARY = /must match exactly one schema in oneOf/;
const MIN_ANCHOR_DEPTH = 2;

interface DiagnosticGroup {
    index: number;
    diagnostic: ISpectralDiagnostic;
    messages: string[];
}

function samePath(a: ISpectralDiagnostic['path'], b: ISpectralDiagnostic['path']): boolean {
    return a.length === b.length && a.every((segment, i) => String(segment) === String(b[i]));
}

function isChildPath(child: ISpectralDiagnostic['path'], parent: ISpectralDiagnostic['path']): boolean {
    return child.length === parent.length + 1 && parent.every((segment, i) => String(segment) === String(child[i]));
}

function groupSchemaDiagnostics(diagnostics: ISpectralDiagnostic[]): DiagnosticGroup[] {
    const groups: DiagnosticGroup[] = [];
    const ordered = diagnostics
        .map((diagnostic, index) => ({ diagnostic, index }))
        .sort((a, b) => a.diagnostic.path.length - b.diagnostic.path.length || a.index - b.index);

    for (const { diagnostic, index } of ordered) {
        const groupable = SCHEMA_RULES.has(String(diagnostic.code)) && diagnostic.path.length >= MIN_ANCHOR_DEPTH;
        const anchor = groupable
            ? groups.find((group) => group.diagnostic.code === diagnostic.code
                && group.diagnostic.path.length >= MIN_ANCHOR_DEPTH
                && (samePath(group.diagnostic.path, diagnostic.path) || isChildPath(diagnostic.path, group.diagnostic.path)))
            : undefined;
        if (anchor) {
            anchor.messages.push(diagnostic.message);
        } else {
            groups.push({ index, diagnostic, messages: [diagnostic.message] });
        }
    }

    return groups.sort((a, b) => a.index - b.index);
}

function toSpectralIssue({ diagnostic, messages }: DiagnosticGroup): ISpectralIssue {
    const [root, endpoint, method] = diagnostic.path;
    const isPathItem = root === 'paths' && endpoint !== undefined;
    const primary = messages.find((message) => ONE_OF_SUMMARY.test(message)) ?? messages[0];
    const details = messages.filter((message) => message !== primary);

    return {
        endpoint: isPathItem ? String(endpoint) : 'global',
        location: diagnostic.path.map(String).join('.'),
        method: isPathItem && method !== undefined ? String(method).toUpperCase() : 'N/A',
        rule: diagnostic.code,
        message: primary,
        ...(details.length > 0 && { details }),
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

        const spectral = createOasSpectral(rulesConfig);

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

        return { issues: groupSchemaDiagnostics(diagnostics).map(toSpectralIssue), rules };
    }
}
