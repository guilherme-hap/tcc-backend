import type { Severity } from '../types/severity.js';
import type { IAuditMessage } from '../messages/catalog.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type {
    ContractRequestInput,
    PerformanceRequestInput,
    SecurityRequestInput,
    FullEvaluationRequestInput,
} from '../schemas/evaluation.schema.js';

export interface ISpectralIssue {
    endpoint: string;
    method: string;
    rule: string | number;
    message: string;
    severity: Severity;
}

export interface ISpectralRule {
    name: string;
    severity: Severity;
}

export interface ISpectralAnalysis {
    issues: ISpectralIssue[];
    rules: ISpectralRule[];
}

export interface IContractSummary {
    evaluatedRules: number;
    violatedRules: number;
    occurrencesByRule: Record<string, number>;
}

export interface IContractResult {
    issues: ISpectralIssue[];
    summary: IContractSummary;
}

export interface IAutocannonResult {
    score: number | null;
    targetLatency: number;
    satisfied: number;
    tolerating: number;
    frustrated: number;
    sampleSize: number;
    excluded4xx: number;
    serverErrors: number;
    unanswered: number;
    errorRate: number;
    averageLatency: number;
    totalRequests: number;
    errors: number;
    timeouts: number;
    warnings: IAuditMessage[];
}

export type SecurityLayer = 'transport' | 'access' | 'content' | 'leakage';

export interface ISecurityCheckResult extends IAuditMessage {
    layer: SecurityLayer;
    header: string;
    status: 'pass' | 'warning' | 'missing' | 'error';
}

export interface IPerformanceTarget {
    path: string;
    method?: HttpMethod | string;
    payload?: any;
}

export interface IPerformanceTargetResult {
    path: string;
    method: string;
    result: IAutocannonResult | null;
    error?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ILoadTestOptions = LoadTestOptionsInput & {
    payloadFactory?: () => string | undefined;
};

export interface IFailedPillar {
    pillar: string;
    error: string;
}

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type EvaluationType = 'contract' | 'performance' | 'security' | 'full';

export interface EvaluationRequestMap {
    contract: ContractRequestInput;
    performance: PerformanceRequestInput;
    security: SecurityRequestInput;
    full: FullEvaluationRequestInput;
}

export interface EvaluationJobOf<T extends EvaluationType> {
    evaluationId: string;
    type: T;
    params: EvaluationRequestMap[T];
}

export type EvaluationJob = { [T in EvaluationType]: EvaluationJobOf<T> }[EvaluationType];
