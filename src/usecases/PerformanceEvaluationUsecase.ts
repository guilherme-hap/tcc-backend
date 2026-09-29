import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';
import { validateLoadTestMethod } from '../utils/httpMethodUtils.js';
import { loadTestOptionsSchema } from '../schemas/loadTestOptions.schema.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { AppError } from '../errors/AppError.js';

export class PerformanceEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IPerformanceRequest, userId?: string | null) {
        if (data.loadTestOptions) {
            const result = loadTestOptionsSchema.safeParse(data.loadTestOptions);
            if (!result.success) {
                throw new AppError(result.error.issues.map((i) => i.message).join('; '), 400);
            }
            data.loadTestOptions = result.data;
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
            evaluationType: 'performance',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
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
