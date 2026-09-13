import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';
import { IAutocannonResult } from '../services/AutocannonService.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ILoadTestOptions {
    duration?: number;
    connections?: number;
    targetLatency?: number;
    maxRequests?: number;
    requestsPerSecond?: number;
    method?: HttpMethod;
    headers?: Record<string, string>;
    body?: string;
    payloadFactory?: () => string | undefined;
    allowMutatingMethods?: boolean;
}

export interface IContractRequest {
    openApiUrl: string;
    rulesConfig?: Record<string, boolean>;
}

export interface IPerformanceRequest {
    openApiUrl: string;
    targetPath: string;
    apiBaseUrl?: string;
    targetMethod?: HttpMethod | string;
    payload?: any;
    loadTestOptions?: ILoadTestOptions;
}

export interface IFullEvaluationRequest {
    openApiUrl: string;
    targetPath: string;
    apiBaseUrl?: string;
    targetMethod?: HttpMethod | string;
    payload?: any;
    rulesConfig?: Record<string, boolean>;
    loadTestOptions?: ILoadTestOptions;
    weights?: {
        contract?: number;
        performance?: number;
    };
}

export interface IFailedPillar {
    pillar: string;
    error: string;
}

export interface IFullEvaluationResult {
    finalScore: number | null;
    contractResult: SpectralResponseDto[] | null;
    performanceResult: IAutocannonResult | null;
    failedPillars: IFailedPillar[];
    status: EvaluationStatus;
}

export type EvaluationStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export type EvaluationType = 'contract' | 'performance' | 'full';
