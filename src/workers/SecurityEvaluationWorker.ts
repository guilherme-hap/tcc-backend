import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SecurityService } from '../services/SecurityService.js';
import { EvaluationJob } from '../queues/EvaluationQueue.js';
import { ISecurityRequest } from '../interfaces/evaluation.interface.js';

export class SecurityEvaluationWorker {
    private lifecycle: EvaluationLifecycleService;
    private securityService: SecurityService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
        this.securityService = new SecurityService();
    }

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId, params } = job;
        const { baseUrl } = params as ISecurityRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const result = await this.securityService.evaluate(baseUrl);

            await this.lifecycle.complete(evaluationId, {
                securityResult: result,
                securityScore: result.score,
                finalScore: result.score,
            });
        } catch (error: any) {
            console.error(`[SecurityWorker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                await this.lifecycle.fail(evaluationId, message);
            } catch (persistError) {
                console.error(`[SecurityWorker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }
}
