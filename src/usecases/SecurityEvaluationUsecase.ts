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

        evaluationQueue.enqueue({
            evaluationId: evaluation.id,
            type: 'security',
            params: data,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
