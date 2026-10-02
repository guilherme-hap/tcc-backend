import type { Severity } from '../types/severity.js';
import type { ISpectralIssue } from '../interfaces/evaluation.interface.js';

export const SEVERITY_PENALTY: Record<Severity, number> = {
    'Error': 10,
    'Warning': 4,
    'Info': 1,
    'Hint': 0.5,
    'Unknown': 0,
};

export function calculateContractScore(
    issues: ISpectralIssue[],
    severityWeights?: Partial<Record<Severity, number>>,
): number {
    const penalties = { ...SEVERITY_PENALTY, ...severityWeights };
    const totalPenalty = issues.reduce((sum, issue) => {
        return sum + (penalties[issue.severity] ?? 0);
    }, 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
}
