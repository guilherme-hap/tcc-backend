import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { IContractRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class ContractEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IContractRequest, userId?: string | null) {
        if (!data?.openApiUrl || typeof data.openApiUrl !== 'string' || !data.openApiUrl.trim()) {
            throw new AppError('openApiUrl is required', 400);
        }

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            evaluationType: 'contract',
            userId: userId ?? null,
        });

        try {
            await evaluationQueue.enqueue({
                evaluationId: evaluation.id,
                type: 'contract',
                params: data,
            });
        } catch (err) {
            await this.lifecycle.fail(evaluation.id, err instanceof Error ? err : String(err));
            throw new AppError(
                `Failed to enqueue contract evaluation: ${err instanceof Error ? err.message : String(err)}`,
                500,
            );
        }

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
