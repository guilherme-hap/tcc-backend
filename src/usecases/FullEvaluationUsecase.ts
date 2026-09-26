import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { IFullEvaluationRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { validateLoadTestMethod } from '../utils/httpMethodUtils.js';

export const DEFAULT_WEIGHTS = {
    contract: 1 / 3,
    performance: 1 / 3,
    security: 1 / 3,
};

export class FullEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IFullEvaluationRequest, userId?: string | null) {
        if (!data?.openApiUrl || typeof data.openApiUrl !== 'string' || !data.openApiUrl.trim()) {
            throw new AppError('openApiUrl is required', 400);
        }
        if (!data?.targetPath || typeof data.targetPath !== 'string' || !data.targetPath.trim()) {
            throw new AppError('targetPath is required', 400);
        }

        this.validateWeights(data.weights);

        validateLoadTestMethod({
            targetMethod: data.targetMethod,
            targetPath: data.targetPath,
            loadTestMethod: data.loadTestOptions?.method,
            allowMutatingMethods: data.loadTestOptions?.allowMutatingMethods,
        });

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl,
            targetPath: data.targetPath,
            targetMethod: data.targetMethod,
            evaluationType: 'full',
            userId: userId ?? null,
        });

        evaluationQueue.enqueue({
            evaluationId: evaluation.id,
            type: 'full',
            params: data,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }

    private validateWeights(weights?: { contract?: number; performance?: number; security?: number }): void {
        if (!weights) return;

        const hasContract = weights.contract !== undefined;
        const hasPerformance = weights.performance !== undefined;
        const hasSecurity = weights.security !== undefined;

        if (!hasContract && !hasPerformance && !hasSecurity) return;

        const contractWeight = weights.contract ?? DEFAULT_WEIGHTS.contract;
        const performanceWeight = weights.performance ?? DEFAULT_WEIGHTS.performance;
        const securityWeight = weights.security ?? DEFAULT_WEIGHTS.security;

        if (contractWeight < 0 || performanceWeight < 0 || securityWeight < 0) {
            throw new AppError('Weights must be non-negative', 400);
        }

        const sum = contractWeight + performanceWeight + securityWeight;
        if (Math.abs(sum - 1) > 0.001) {
            const formatWeight = (val: number, isExplicit: boolean) =>
                isExplicit ? `${val}` : `${Number(val.toFixed(4))} (default 1/3)`;

            const hasDefaulted = !hasContract || !hasPerformance || !hasSecurity;
            const note = hasDefaulted
                ? ' Note: omitted weights automatically use their default (1/3). When customizing weights, specify all three or ensure the sum including defaults equals 1.'
                : '';

            throw new AppError(
                `Weights must sum to 1. Received: contract=${formatWeight(contractWeight, hasContract)}, performance=${formatWeight(performanceWeight, hasPerformance)}, security=${formatWeight(securityWeight, hasSecurity)} (sum=${Number(sum.toFixed(4))}).${note}`,
                400
            );
        }
    }
}
