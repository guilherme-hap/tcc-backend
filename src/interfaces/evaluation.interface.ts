import type { Severity } from '../types/severity.js';
import type { AuditMessageCode, IAuditMessage } from '../messages/catalog.js';
import type { ErrorCode } from '../messages/errors.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type { HttpMethod } from '../schemas/shared.js';
import type { EvaluationWeights } from '../utils/weights.js';
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

export type OasVersion = '2.0' | '3.0' | '3.1';

export interface ISpectralCatalogRule extends ISpectralRule {
    description: string | null;
    enabledByDefault: boolean;
    oasVersions: OasVersion[];
    documentationUrl: string | null;
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

export interface IPerformanceTargetResult {
    path: string;
    method: string;
    result: IAutocannonResult | null;
    error?: string;
    code?: ErrorCode;
}

export type ILoadTestOptions = Omit<LoadTestOptionsInput, 'method'> & {
    method: HttpMethod;
    payloadFactory?: () => string | undefined;
};

export type IEvaluationRequestSettings =
    Pick<FullEvaluationRequestInput, 'rulesConfig' | 'severityWeights' | 'weights' | 'minScore'> & {
        loadTestOptions?: Omit<LoadTestOptionsInput, 'headers' | 'body'>;
    };

export type FailureCode = ErrorCode | AuditMessageCode;

export interface IFailedPillar {
    pillar: keyof EvaluationWeights;
    error: string;
    code: FailureCode;
}

export type IPillarScores = Partial<Record<keyof EvaluationWeights, number>>;

export interface IPillarScoring {
    contract?: {
        severityWeights: Record<Severity, number>;
        rules: ISpectralRule[];
    };
    performance?: {
        targetLatency: number;
    };
    security?: {
        layerWeights: Record<SecurityLayer, number>;
        statusScores: Record<ISecurityCheckResult['status'], number>;
    };
}

export interface IScoringParameters extends IPillarScoring {
    pillarWeights: IPillarScores;
}

export interface IScorePart {
    id: string;
    weight: number;
    score: number;
    points: number;
    maxPoints: number;
}

export type IScoreBreakdown = Partial<Record<keyof EvaluationWeights | 'final', IScorePart[]>>;

export const EVALUATION_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'] as const;

export type EvaluationStatus = typeof EVALUATION_STATUSES[number];

export const EVALUATION_TYPES = ['contract', 'performance', 'security', 'full'] as const;

export type EvaluationType = typeof EVALUATION_TYPES[number];

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
