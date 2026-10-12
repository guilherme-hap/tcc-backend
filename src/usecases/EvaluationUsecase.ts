import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { AppError } from '../errors/AppError.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { EVALUATION_SCHEMAS } from '../schemas/evaluation.schema.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import type { EvaluationJobOf, EvaluationType, IEvaluationRequestSettings, IPerformanceTarget } from '../interfaces/evaluation.interface.js';

interface PersistedRequestFields {
    openApiUrl: string;
    apiBaseUrl?: string;
    targets?: IPerformanceTarget[];
    rulesConfig?: Record<string, boolean>;
    loadTestOptions?: LoadTestOptionsInput;
    minScore?: number;
}

function toRequestSettings(request: PersistedRequestFields): IEvaluationRequestSettings | null {
    const settings: IEvaluationRequestSettings = {};

    if (request.rulesConfig) settings.rulesConfig = request.rulesConfig;
    if (request.loadTestOptions) {
        const { headers: _headers, body: _body, ...loadTestOptions } = request.loadTestOptions;
        settings.loadTestOptions = loadTestOptions;
    }
    if (request.minScore !== undefined) settings.minScore = request.minScore;

    return Object.keys(settings).length > 0 ? settings : null;
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
            requestSettings: toRequestSettings(request),
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
            const failure = new AppError('EVALUATION_ENQUEUE_FAILED');
            await this.lifecycle
                .fail(job.evaluationId, failure)
                .catch((e) => console.error(`[Enqueue] Failed to persist FAILED for ${job.evaluationId}:`, e));
            throw failure;
        }
    }
}
