import type { SecurityCheckResult } from '../interfaces/security.interface.js';

export function calculateSecurityScore(checks: SecurityCheckResult[]): number {
    if (checks.length === 0) return 0;

    const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
    if (totalWeight === 0) return 0;

    const totalEarned = checks.reduce((sum, check) => sum + check.earnedScore, 0);

    return Math.round((totalEarned / totalWeight) * 100 * 100) / 100;
}
