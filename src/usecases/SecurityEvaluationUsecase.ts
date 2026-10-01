import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { ISecurityRequest } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { securityRequestSchema } from '../schemas/evaluation.schema.js';

export class SecurityEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: ISecurityRequest, userId?: string | null) {
        const parsed = securityRequestSchema.safeParse(data);
        if (!parsed.success) {
            throw new AppError(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; '), 400);
        }
        data = parsed.data;

        const evaluation = await this.lifecycle.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl,
            evaluationType: 'security',
            userId: userId ?? null,
        });

        await enqueueOrFail(this.lifecycle, {
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
