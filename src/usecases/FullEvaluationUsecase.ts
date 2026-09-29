import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IFullEvaluationRequest } from '../interfaces/evaluation.interface.js';
import { validateLoadTestMethod } from '../utils/httpMethodUtils.js';
import { loadTestOptionsSchema } from '../schemas/loadTestOptions.schema.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';

export { DEFAULT_WEIGHTS } from '../utils/weights.js';

export class FullEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IFullEvaluationRequest, userId?: string | null) {
        if (data.loadTestOptions) {
            data.loadTestOptions = loadTestOptionsSchema.parse(data.loadTestOptions);
        }

        validateLoadTestMethod({
            targetMethod: data.targetMethod,
            targetPath: data.targetPath,
            loadTestMethod: data.loadTestOptions?.method,
            allowMutatingMethods: data.loadTestOptions?.allowMutatingMethods,
        });

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl,
            targetPath: data.targetPath,
            targetMethod: data.targetMethod,
            evaluationType: 'full',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
            evaluationId: evaluation.id,
            type: 'full',
            params: data,
        });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}

