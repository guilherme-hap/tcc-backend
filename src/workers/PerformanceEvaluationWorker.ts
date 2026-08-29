import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { resolveBaseUrl } from '../utils/resolveBaseUrl.js';
import { EvaluationJob } from '../queues/EvaluationQueue.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';

export class PerformanceEvaluationWorker {
    private lifecycle: EvaluationLifecycleService;
    private autocannonService: AutocannonService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
        this.autocannonService = new AutocannonService();
    }

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId, params } = job;
        const { swaggerUrl, baseUrl, loadTestOptions } = params as IPerformanceRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const targetBaseUrl = baseUrl?.trim()
                ? baseUrl.trim()
                : await resolveBaseUrl(swaggerUrl);

            const result = await this.autocannonService.runLoadTest(targetBaseUrl, loadTestOptions || {});

            await this.lifecycle.complete(evaluationId, {
                autocannonResult: result,
                finalScore: result.score,
            });
        } catch (error: any) {
            console.error(`[PerformanceWorker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                await this.lifecycle.fail(evaluationId, message);
            } catch (persistError) {
                console.error(`[PerformanceWorker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }
}
