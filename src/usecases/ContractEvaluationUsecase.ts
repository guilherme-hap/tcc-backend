import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { IContractRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class ContractEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IContractRequest) {
        if (!data.swaggerUrl) {
            throw new AppError('swaggerUrl is required', 400);
        }

        const evaluation = await this.lifecycle.create({
            swaggerUrl: data.swaggerUrl,
            evaluationType: 'contract',
        });

        evaluationQueue.enqueue({
            evaluationId: evaluation.id,
            type: 'contract',
            params: data,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
