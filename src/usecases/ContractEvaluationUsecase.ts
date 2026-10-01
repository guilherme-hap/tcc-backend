import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IContractRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { contractRequestSchema } from '../schemas/evaluation.schema.js';

export class ContractEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IContractRequest, userId?: string | null) {
        const parsed = contractRequestSchema.safeParse(data);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; '), 400);
        }
        data = parsed.data;

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
