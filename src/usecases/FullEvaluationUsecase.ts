import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IFullEvaluationRequest } from '../interfaces/evaluation.interface.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { fullEvaluationRequestSchema } from '../schemas/evaluation.schema.js';

export class FullEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IFullEvaluationRequest, userId?: string | null) {
        const requestData = parseOrThrow(fullEvaluationRequestSchema, data);

        const evaluation = await this.lifecycle.create({
            openApiUrl: requestData.openApiUrl,
            apiBaseUrl: requestData.apiBaseUrl,
            targets: requestData.targets,
            evaluationType: 'full',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
            evaluationId: evaluation.id,
            type: 'full',
            params: requestData,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
