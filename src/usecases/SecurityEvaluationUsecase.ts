import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { ISecurityRequest } from '../interfaces/evaluation.interface.js';
import { enqueueOrFail } from '../utils/enqueueOrFail.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { securityRequestSchema } from '../schemas/evaluation.schema.js';

export class SecurityEvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute(data: ISecurityRequest, userId?: string | null) {
        data = parseOrThrow(securityRequestSchema, data);

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
