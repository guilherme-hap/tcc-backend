import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';
import { IAutocannonResult } from '../services/AutocannonService.js';
import { ISecurityCheckResult } from '../services/SecurityService.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type {
    ContractRequestInput,
    PerformanceRequestInput,
    SecurityRequestInput,
    FullEvaluationRequestInput,
} from '../schemas/evaluation.schema.js';

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

export interface IFullEvaluationResult {
    finalScore: number | null;
    contractResult: SpectralResponseDto[] | null;
    performanceResults: IPerformanceTargetResult[] | null;
    securityResult: ISecurityCheckResult[] | null;
    failedPillars: IFailedPillar[];
    status: EvaluationStatus;
}

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type EvaluationType = 'contract' | 'performance' | 'security' | 'full';
