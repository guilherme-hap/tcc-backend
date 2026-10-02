import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IContractRequest } from '../interfaces/evaluation.interface.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { contractRequestSchema } from '../schemas/evaluation.schema.js';

export class ContractEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IContractRequest, userId?: string | null) {
        data = parseOrThrow(contractRequestSchema, data);

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            evaluationType: 'contract',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
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
