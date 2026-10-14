import { AppDataSource } from '../config/data-source.js';
import type { Evaluation } from '../entities/Evaluation.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { AppError } from '../errors/AppError.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { EVALUATION_SCHEMAS } from '../schemas/evaluation.schema.js';
import { initialSteps } from '../pillars/pipelines.js';
import type { FullEvaluationRequestInput } from '../schemas/evaluation.schema.js';
import type { EvaluationType, IEvaluationRequestSettings } from '../interfaces/evaluation.interface.js';

type PersistedRequestFields = Pick<FullEvaluationRequestInput, 'openApiUrl'> & Partial<FullEvaluationRequestInput>;

function toRequestSettings(request: PersistedRequestFields): IEvaluationRequestSettings | null {
    const settings: IEvaluationRequestSettings = {};

    if (request.rulesConfig) settings.rulesConfig = request.rulesConfig;
    if (request.loadTestOptions) {
        const { headers: _headers, body: _body, ...loadTestOptions } = request.loadTestOptions;
        settings.loadTestOptions = loadTestOptions;
    }
    if (request.severityWeights) settings.severityWeights = request.severityWeights;
    if (request.weights) settings.weights = request.weights;
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

        let evaluation: Evaluation;
        try {
            evaluation = await AppDataSource.transaction(async (manager) => {
                const created = await this.lifecycle.create({
                    openApiUrl: request.openApiUrl,
                    apiBaseUrl: request.apiBaseUrl,
                    targets: request.targets,
                    requestSettings: toRequestSettings(request),
                    evaluationType: type,
                    userId: userId ?? null,
                    steps: initialSteps(type),
                }, manager);
                await evaluationQueue.enqueue({ evaluationId: created.id, type, params }, manager);
                return created;
            });
        } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            console.error(`[Enqueue] Failed to create the ${type} evaluation:`, detail);
            throw new AppError('EVALUATION_ENQUEUE_FAILED');
        }

        return {
            evaluationId: evaluation.id,
            status: evaluation.status,
        };
    }
}
