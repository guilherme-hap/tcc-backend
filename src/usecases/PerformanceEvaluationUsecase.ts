import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';
import { prepareTargetsRequest } from '../utils/prepareTargetsRequest.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';

export class PerformanceEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IPerformanceRequest, userId?: string | null) {
        const requestData = prepareTargetsRequest(data);

        const evaluation = await this.lifecycle.create({
            openApiUrl: requestData.openApiUrl,
            apiBaseUrl: requestData.apiBaseUrl,
            targets: requestData.targets,
            evaluationType: 'performance',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
            evaluationId: evaluation.id,
            type: 'performance',
            params: requestData,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
