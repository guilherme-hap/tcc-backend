import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { AppError } from '../errors/AppError.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { EVALUATION_SCHEMAS } from '../schemas/evaluation.schema.js';
import type { EvaluationJobOf, EvaluationType, IPerformanceTarget } from '../interfaces/evaluation.interface.js';

interface PersistedRequestFields {
    openApiUrl: string;
    apiBaseUrl?: string;
    targets?: IPerformanceTarget[];
}

export class EvaluationUsecase {
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
    }

    async execute<T extends EvaluationType>(type: T, data: unknown, userId?: string | null) {
        const params = parseOrThrow(EVALUATION_SCHEMAS[type], data);
        const request: PersistedRequestFields = params;

        const evaluation = await this.lifecycle.create({
            openApiUrl: request.openApiUrl,
            apiBaseUrl: request.apiBaseUrl,
            targets: request.targets,
            evaluationType: type,
            userId: userId ?? null,
        });

        await this.enqueueOrFail({ evaluationId: evaluation.id, type, params });

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }

    private async enqueueOrFail<T extends EvaluationType>(job: EvaluationJobOf<T>): Promise<void> {
        try {
            await evaluationQueue.enqueue(job);
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.error(`[Enqueue] Failed for evaluation ${job.evaluationId}:`, detail);
            await this.lifecycle
                .fail(job.evaluationId, `Failed to enqueue ${job.type} evaluation: ${detail}`)
                .catch((e) => console.error(`[Enqueue] Failed to persist FAILED for ${job.evaluationId}:`, e));
            throw new AppError(`Could not queue ${job.type} evaluation. Please try again later.`, 500);
        }
    }
}
