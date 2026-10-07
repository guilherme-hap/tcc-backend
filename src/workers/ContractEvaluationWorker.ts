import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SpectralService } from '../services/SpectralService.js';
import { buildContractResult, calculateContractScore } from '../utils/calculateContractScore.js';
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
        const { openApiUrl, rulesConfig, severityWeights } = params as IContractRequest;

        try {
            const analysis = await this.spectralService.analyze(openApiUrl, rulesConfig || {});
            const score = calculateContractScore(analysis.issues, analysis.rules, severityWeights);

            await this.lifecycle.complete(evaluationId, {
                spectralResult: buildContractResult(analysis),
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
