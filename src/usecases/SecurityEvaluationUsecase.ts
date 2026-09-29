import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { ISecurityRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class SecurityEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: ISecurityRequest, userId?: string | null) {
        if (!data?.openApiUrl || typeof data.openApiUrl !== 'string' || !data.openApiUrl.trim()) {
            throw new AppError('openApiUrl is required', 400);
        }

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl,
            evaluationType: 'security',
            userId: userId ?? null,
        });

        try {
            await evaluationQueue.enqueue({
                evaluationId: evaluation.id,
                type: 'security',
                params: data,
            });
        } catch (err) {
            await this.lifecycle.fail(evaluation.id, err instanceof Error ? err : String(err));
            throw new AppError(
                `Failed to enqueue security evaluation: ${err instanceof Error ? err.message : String(err)}`,
                500,
            );
        }

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
