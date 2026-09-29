import { SpectralResponseDto, SpectralSeverity } from '../dtos/SpectralResponseDto.js';
import { IAutocannonResult } from '../services/AutocannonService.js';
import { ISecurityCheckResult } from '../services/SecurityService.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type { PerformanceRequestInput, FullEvaluationRequestInput } from '../schemas/evaluation.schema.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ILoadTestOptions = LoadTestOptionsInput & {
    payloadFactory?: () => string | undefined;
};

export interface IContractRequest {
    openApiUrl: string;
    rulesConfig?: Record<string, boolean>;
    severityWeights?: Partial<Record<SpectralSeverity, number>>;
}

export type IPerformanceRequest = PerformanceRequestInput;

export interface ISecurityRequest {
    openApiUrl: string;
    apiBaseUrl?: string;
}

export type IFullEvaluationRequest = FullEvaluationRequestInput;

export interface IFailedPillar {
    pillar: string;
    error: string;
}

export interface IFullEvaluationResult {
    finalScore: number | null;
    contractResult: SpectralResponseDto[] | null;
    performanceResult: IAutocannonResult | null;
    securityResult: ISecurityCheckResult[] | null;
    failedPillars: IFailedPillar[];
    status: EvaluationStatus;
}

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type EvaluationType = 'contract' | 'performance' | 'security' | 'full';
