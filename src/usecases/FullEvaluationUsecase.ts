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

        try {
            await evaluationQueue.enqueue({
                evaluationId: evaluation.id,
                type: 'full',
                params: data,
            });
        } catch (err) {
            await this.lifecycle.fail(evaluation.id, err instanceof Error ? err : String(err));
            throw new AppError(
                `Failed to enqueue full evaluation: ${err instanceof Error ? err.message : String(err)}`,
                500,
            );
        }

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}

