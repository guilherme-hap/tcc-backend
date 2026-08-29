import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';
import { IAutocannonResult } from '../services/AutocannonService.js';

export interface ILoadTestOptions {
    duration?: number;
    connections?: number;
    targetLatency?: number;
    maxRequests?: number;
    requestsPerSecond?: number;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: string;
}

export interface IContractRequest {
    swaggerUrl: string;
    rulesConfig?: Record<string, boolean>;
}

export interface IPerformanceRequest {
    swaggerUrl: string;
    baseUrl?: string;
    loadTestOptions?: ILoadTestOptions;
}

export interface IFullEvaluationRequest {
    swaggerUrl: string;
    baseUrl?: string;
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
