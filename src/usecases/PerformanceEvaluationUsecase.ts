import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';
import { validateLoadTestMethod } from '../utils/httpMethodUtils.js';
import { loadTestOptionsSchema } from '../schemas/loadTestOptions.schema.js';
import { validateTotalDuration } from '../utils/loadTestLimits.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { AppError } from '../errors/AppError.js';

export class PerformanceEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: IPerformanceRequest, userId?: string | null) {
        let loadTestOptions = data.loadTestOptions;
        if (loadTestOptions) {
            const result = loadTestOptionsSchema.safeParse(loadTestOptions);
            if (!result.success) {
                throw new AppError(result.error.issues.map((i) => i.message).join('; '), 400);
            }
            loadTestOptions = result.data;
        }

        const requestData: IPerformanceRequest = {
            ...data,
            ...(loadTestOptions !== undefined ? { loadTestOptions } : {}),
        };

        if (!requestData.targets || requestData.targets.length === 0) {
            throw new AppError('targets is required and must contain at least one target', 400);
        }

        validateTotalDuration(requestData);

        requestData.targets.forEach((target, index) => {
            try {
                validateLoadTestMethod({
                    targetMethod: target.method,
                    targetPath: target.path,
                    loadTestMethod: requestData.loadTestOptions?.method,
                    allowMutatingMethods: requestData.loadTestOptions?.allowMutatingMethods,
                });
            } catch (err: any) {
                const message = err instanceof Error ? err.message : String(err);
                throw new AppError(`targets[${index}]: ${message}`, 400);
            }
        });

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
