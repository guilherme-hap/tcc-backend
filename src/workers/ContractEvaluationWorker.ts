import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SpectralService } from '../services/SpectralService.js';
import { calculateContractScore } from '../utils/calculateContractScore.js';
import { EvaluationJob } from '../queues/EvaluationQueue.js';
import { IContractRequest } from '../interfaces/evaluation.interface.js';

export class ContractEvaluationWorker {
    private lifecycle: EvaluationLifecycleService;
    private spectralService: SpectralService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
        this.spectralService = new SpectralService();
    }

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId, params } = job;
        const { swaggerUrl, rulesConfig } = params as IContractRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const issues = await this.spectralService.analyze(swaggerUrl, rulesConfig || {});
            const score = calculateContractScore(issues);

            await this.lifecycle.complete(evaluationId, {
                spectralResult: issues,
                finalScore: score,
            });
        } catch (error: any) {
            console.error(`[ContractWorker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                await this.lifecycle.fail(evaluationId, message);
            } catch (persistError) {
                console.error(`[ContractWorker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }
}
