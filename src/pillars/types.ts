import type {
    EvaluationRequestMap,
    EvaluationType,
    IContractResult,
    IPerformanceTargetResult,
    IPillarScores,
    IPillarScoring,
    IScorePart,
    ISecurityCheckResult,
} from '../interfaces/evaluation.interface.js';
import type { IAuditMessage } from '../messages/catalog.js';
import type { ParsedOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import type { EvaluationWeights } from '../utils/weights.js';

export type PillarName = keyof EvaluationWeights;

export interface PillarResults {
    spectralResult: IContractResult;
    performanceResults: IPerformanceTargetResult[];
    securityResult: ISecurityCheckResult[];
}

export type PillarColumn = keyof PillarResults;

export interface PillarBaseParams {
    openApiUrl: string;
    apiBaseUrl?: string | null;
}

export interface PillarContext<P extends PillarBaseParams> {
    params: P;
    spec: () => Promise<ParsedOpenApiContent>;
    apiBaseUrl: () => Promise<string>;
}

export interface PillarOutcome<C extends PillarColumn = PillarColumn> {
    score: number;
    breakdown: IScorePart[];
    result: PillarResults[C];
    scoring: IPillarScoring;
}

export interface Pillar<P extends PillarBaseParams, C extends PillarColumn = PillarColumn> {
    name: PillarName;
    column: C;
    run: (ctx: PillarContext<P>) => Promise<PillarOutcome<C>>;
}

export interface Pipeline<P extends PillarBaseParams> {
    stages: readonly (readonly Pillar<P>[])[];
    weights: (params: P) => IPillarScores;
    precondition?: (pillar: PillarName, results: Partial<PillarResults>) => IAuditMessage | null;
}

export type Pipelines = { [T in EvaluationType]: Pipeline<EvaluationRequestMap[T]> };
