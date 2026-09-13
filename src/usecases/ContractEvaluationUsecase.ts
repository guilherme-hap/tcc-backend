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
        if (!data?.openApiUrl || typeof data.openApiUrl !== 'string' || !data.openApiUrl.trim()) {
            throw new AppError('openApiUrl is required', 400);
        }

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
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
