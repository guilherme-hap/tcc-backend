import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { runPerformanceTargets, PerformancePillarError } from '../utils/runPerformanceTargets.js';
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
            targets,
            loadTestOptions,
        } = params as IPerformanceRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const { score, performanceResults } = await runPerformanceTargets({
                openApiUrl,
                apiBaseUrl,
                targets,
                loadTestOptions,
                autocannonService: this.autocannonService,
            });

            await this.lifecycle.complete(evaluationId, {
                performanceResults,
                finalScore: score,
            });
        } catch (error: any) {
            console.error(`[PerformanceWorker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                const extra = error instanceof PerformancePillarError
                    ? { performanceResults: error.performanceResults }
                    : undefined;
                await this.lifecycle.fail(evaluationId, message, extra);
            } catch (persistError) {
                console.error(`[PerformanceWorker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }
}
