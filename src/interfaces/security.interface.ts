export type SecurityCheckCategory =
    | 'TRANSPORT'
    | 'ACCESS_CONTROL'
    | 'INJECTION_FRAMING'
    | 'INFO_LEAKAGE';

export type SecurityCheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface SecurityCheckResult {
    header: string;
    category: SecurityCheckCategory;
    status: SecurityCheckStatus;
    weight: number;
    earnedScore: number;
    expected: string;
    actualValue: string | null;
    message: string;
    recommendation: string;
}

export interface SecurityEvaluationResult {
    score: number;
    status: SecurityCheckStatus;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    details: SecurityCheckResult[];
}
