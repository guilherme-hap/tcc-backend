import type { Severity } from '../types/severity.js';
import type { IContractResult, IScorePart, ISpectralAnalysis, ISpectralIssue, ISpectralRule } from '../interfaces/evaluation.interface.js';
import { scorePart } from './scorePart.js';

export const SEVERITY_WEIGHTS: Record<Severity, number> = {
    'Error': 0.5208,
    'Warning': 0.2708,
    'Info': 0.1458,
    'Hint': 0.0625,
    'Unknown': 0,
};

export function resolveSeverityWeights(severityWeights?: Partial<Record<Severity, number>>): Record<Severity, number> {
    return { ...SEVERITY_WEIGHTS, ...severityWeights };
}

interface IContractRuleSet {
    applicable: Map<string, Severity>;
    violated: Set<string>;
    occurrencesByRule: Record<string, number>;
}

function buildRuleSet(
    issues: ISpectralIssue[],
    rules: ISpectralRule[],
    weights: Record<Severity, number>,
): IContractRuleSet {
    const applicable = new Map<string, Severity>(rules.map((rule) => [rule.name, rule.severity]));
    const violated = new Set<string>();
    const occurrencesByRule: Record<string, number> = {};
    const extraSeverity = new Map<string, Severity>();
    const knownRules = new Set(applicable.keys());

    for (const issue of issues) {
        const code = String(issue.rule);
        violated.add(code);
        occurrencesByRule[code] = (occurrencesByRule[code] ?? 0) + 1;

        if (!knownRules.has(code)) {
            const current = extraSeverity.get(code);
            if (current === undefined || (weights[issue.severity] ?? 0) > (weights[current] ?? 0)) {
                extraSeverity.set(code, issue.severity);
            }
        }
    }

    for (const [code, severity] of extraSeverity) {
        applicable.set(code, severity);
    }

    return { applicable, violated, occurrencesByRule };
}

export function buildContractResult({ issues, rules }: ISpectralAnalysis): IContractResult {
    const { applicable, violated, occurrencesByRule } = buildRuleSet(issues, rules, SEVERITY_WEIGHTS);
    return {
        issues,
        summary: {
            evaluatedRules: applicable.size,
            violatedRules: violated.size,
            occurrencesByRule,
        },
    };
}

export function calculateContractScore(
    issues: ISpectralIssue[],
    rules: ISpectralRule[],
    severityWeights?: Partial<Record<Severity, number>>,
): { score: number; breakdown: IScorePart[] } {
    const weights = resolveSeverityWeights(severityWeights);
    const { applicable, violated } = buildRuleSet(issues, rules, weights);

    const bySeverity = new Map<Severity, { total: number; violated: number }>();
    let total = 0;
    let violatedTotal = 0;
    for (const [code, severity] of applicable) {
        const weight = weights[severity] ?? 0;
        const group = bySeverity.get(severity) ?? { total: 0, violated: 0 };
        group.total += weight;
        total += weight;
        if (violated.has(code)) {
            group.violated += weight;
            violatedTotal += weight;
        }
        bySeverity.set(severity, group);
    }

    if (total <= 0) return { score: 100, breakdown: [] };
    const score = 100 * (1 - violatedTotal / total);
    const breakdown: IScorePart[] = [];
    for (const severity of Object.keys(SEVERITY_WEIGHTS) as Severity[]) {
        const group = bySeverity.get(severity);
        if (!group || group.total <= 0) continue;
        breakdown.push(scorePart(severity, group.total / total, 100 * (1 - group.violated / group.total)));
    }

    return {
        score: Math.round(Math.max(0, Math.min(100, score)) * 100) / 100,
        breakdown,
    };
}
