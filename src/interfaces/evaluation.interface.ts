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

export interface IAutocannonResult {
    score: number;
    averageLatency: number;
    totalRequests: number;
    errors: number;
    timeouts: number;
    nonSuccessResponses: number;
    warnings: IAuditMessage[];
}

export interface ISecurityCheckResult extends IAuditMessage {
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

export type IContractRequest = ContractRequestInput;

export type IPerformanceRequest = PerformanceRequestInput;

export type ISecurityRequest = SecurityRequestInput;

export type IFullEvaluationRequest = FullEvaluationRequestInput;

export interface IFailedPillar {
    pillar: string;
    error: string;
}

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type EvaluationType = 'contract' | 'performance' | 'security' | 'full';
