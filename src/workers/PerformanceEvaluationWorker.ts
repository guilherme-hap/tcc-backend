import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { resolveTargetUrl, prepareLoadTestOptions } from '../utils/resolveTargetUrl.js';
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
        const {
            openApiUrl,
            apiBaseUrl,
            targetPath,
            targetMethod,
            payload,
            loadTestOptions,
        } = params as IPerformanceRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const targetUrl = await resolveTargetUrl(openApiUrl, targetPath, apiBaseUrl);
            const options = prepareLoadTestOptions({ targetMethod, payload, loadTestOptions });

            const result = await this.autocannonService.runLoadTest(targetUrl, options);

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
