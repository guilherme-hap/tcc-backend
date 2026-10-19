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

export interface ILatencySummary {
    min: number;
    mean: number;
    p50: number;
    p95: number | null;
    p99: number | null;
    p99_9: number | null;
    max: number;
}

export interface IPerformanceSeriesPoint {
    second: number;
    responses: number;
    meanLatency: number | null;
    errors: number;
}

export interface ISaturation {
    cpuUsage: number;
    eventLoopDelayP99Ms: number;
    exceeded: boolean;
}

export interface IDispersion {
    stddev: number;
    min: number;
    max: number;
}

export interface IFirstFailure {
    statusCode: number | null;
    errorCode: string | null;
    bodySnippet: string | null;
}

export interface IAutocannonRunResult {
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
    latency: ILatencySummary | null;
    requestsPerSecond: number;
    statusCodes: Record<string, number>;
    series: IPerformanceSeriesPoint[];
    totalRequests: number;
    errors: number;
    timeouts: number;
    firstFailure?: IFirstFailure | null;
    warnings: IAuditMessage[];
    saturation: ISaturation;
}

export interface IPerformanceRun {
    run: number;
    result: IAutocannonRunResult | null;
    error?: string;
    code?: ErrorCode;
}

export interface IAutocannonResult extends Omit<IAutocannonRunResult, 'saturation'> {
    runCount: number;
    runsCounted: number;
    dispersion: IDispersion | null;
    runs: IPerformanceRun[];
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

export type MeasurementMode = 'complete' | 'quick';

export type SharedMachineStatus = 'shared' | 'separate' | 'unverified';

export type StabilityStatus = 'stable' | 'low' | 'not_measured';

export type ILoadTestOptions = Omit<LoadTestOptionsInput, 'method'> & {
    method: HttpMethod;
    payloadFactory?: () => string | undefined;
};

export type IEvaluationRequestSettings =
    Pick<FullEvaluationRequestInput, 'rulesConfig' | 'severityWeights' | 'weights' | 'minScore'> & {
        loadTestOptions?: Omit<LoadTestOptionsInput, 'headers' | 'body'>;
    };

export type FailureCode = ErrorCode | AuditMessageCode;

export type EvaluationStepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'INTERRUPTED';

export interface IStepProgress {
    targetIndex: number;
    totalTargets: number;
    run: number;
    totalRuns: number;
    phase: 'QUEUED' | 'RUNNING' | 'RESTING';
    startedAt: string | null;
    expectedDurationSeconds: number;
    elapsedSeconds: number;
    responses: number;
    errors: number;
    lastSecond: IPerformanceSeriesPoint | null;
}

export type ILoadTestTick = Pick<IStepProgress, 'elapsedSeconds' | 'responses' | 'errors'> & {
    lastSecond: IPerformanceSeriesPoint;
};

export interface IEvaluationStep {
    pillar: keyof EvaluationWeights;
    stage: number;
    status: EvaluationStepStatus;
    startedAt: string | null;
    finishedAt: string | null;
    error?: string;
    code?: FailureCode;
    progress?: IStepProgress;
}

export type IPillarScores = Partial<Record<keyof EvaluationWeights, number>>;

export interface IPillarScoring {
    contract?: {
        severityWeights: Record<Severity, number>;
        rules: ISpectralRule[];
    };
    performance?: {
        targetLatency: number;
        mode: MeasurementMode;
        repetitions: number;
        restIntervalSeconds: number;
        thresholds: {
            status: 'provisional';
            maxCpuUsage: number;
            maxEventLoopDelayMs: number;
            stabilityThreshold: number;
        };
        execution: {
            host: string;
            pid: number;
            workerMode: 'embedded' | 'external';
            apiHost: string;
            sameMachine: SharedMachineStatus;
        };
        runScores: (number | null)[];
        stability: {
            status: StabilityStatus;
            coefficientOfVariation: number | null;
            dispersion: IDispersion | null;
            runsCounted: number;
        };
        warnings: IAuditMessage[];
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
