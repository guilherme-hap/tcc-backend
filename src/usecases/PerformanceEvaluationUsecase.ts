import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class PerformanceEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IPerformanceRequest) {
        if (!data.swaggerUrl) {
            throw new AppError('swaggerUrl is required', 400);
        }

        const evaluation = await this.lifecycle.create({
            swaggerUrl: data.swaggerUrl,
            baseUrl: data.baseUrl,
            evaluationType: 'performance',
        });

        evaluationQueue.enqueue({
            evaluationId: evaluation.id,
            type: 'performance',
            params: data,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
