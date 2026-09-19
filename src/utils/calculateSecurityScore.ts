import type { Severity } from '../types/severity.js';
import type { ISecurityCheckResult } from '../services/SecurityService.js';

export const SECURITY_SEVERITY_PENALTY: Record<Severity, number> = {
    'Error': 15,
    'Warning': 5,
    'Info': 1,
    'Hint': 0,
    'Unknown': 0,
};

export function calculateSecurityScore(results: ISecurityCheckResult[]): number {
    const totalPenalty = results
        .filter(r => r.status !== 'pass')
        .reduce((sum, r) => sum + (SECURITY_SEVERITY_PENALTY[r.severity] ?? 0), 0);
    return Math.max(0, Math.min(100, 100 - totalPenalty));
}
