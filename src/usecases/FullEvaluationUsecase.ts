import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { IFullEvaluationRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

const DEFAULT_WEIGHTS = { contract: 0.5, performance: 0.5 };

export class FullEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IFullEvaluationRequest) {
        if (!data?.openApiUrl || typeof data.openApiUrl !== 'string' || !data.openApiUrl.trim()) {
            throw new AppError('openApiUrl is required', 400);
        }
        if (!data?.targetPath || typeof data.targetPath !== 'string' || !data.targetPath.trim()) {
            throw new AppError('targetPath is required', 400);
        }

        this.validateWeights(data.weights);

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl,
            targetPath: data.targetPath,
            targetMethod: data.targetMethod,
            evaluationType: 'full',
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

    private validateWeights(weights?: { contract?: number; performance?: number }): void {
        if (!weights) return;

        const hasContract = weights.contract !== undefined;
        const hasPerformance = weights.performance !== undefined;

        if (!hasContract && !hasPerformance) return;

        const contractWeight = weights.contract ?? DEFAULT_WEIGHTS.contract;
        const performanceWeight = weights.performance ?? DEFAULT_WEIGHTS.performance;

        if (contractWeight < 0 || performanceWeight < 0) {
            throw new AppError('Weights must be non-negative', 400);
        }

        const sum = contractWeight + performanceWeight;
        if (Math.abs(sum - 1) > 0.001) {
            throw new AppError(
                `Weights must sum to 1. Received: contract=${contractWeight}, performance=${performanceWeight} (sum=${sum})`,
                400
            );
        }
    }
}

export { DEFAULT_WEIGHTS };
