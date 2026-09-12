import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { ISecurityRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class SecurityEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: ISecurityRequest) {
        if (!data.baseUrl) {
            throw new AppError('baseUrl is required for security evaluation', 400);
        }

        const evaluation = await this.lifecycle.create({
            swaggerUrl: data.baseUrl,
            baseUrl: data.baseUrl,
            evaluationType: 'security',
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
