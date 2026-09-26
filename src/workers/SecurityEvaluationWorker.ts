import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SecurityService } from '../services/SecurityService.js';
import { calculateSecurityScore } from '../utils/calculateSecurityScore.js';
import { fetchOpenApiSpec } from '../utils/fetchOpenApiSpec.js';
import { resolveBaseUrlFromSpec } from '../utils/resolveBaseUrl.js';
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
        const { openApiUrl, apiBaseUrl } = params as ISecurityRequest;

        try {
            await this.lifecycle.start(evaluationId);

            let targetUrl: string;
            if (apiBaseUrl?.trim()) {
                targetUrl = apiBaseUrl.trim();
            } else {
                const spec = await fetchOpenApiSpec(openApiUrl);
                targetUrl = resolveBaseUrlFromSpec(spec, openApiUrl);
            }

            const results = await this.securityService.analyze(targetUrl);
            const score = calculateSecurityScore(results);

            await this.lifecycle.complete(evaluationId, {
                securityResult: results,
                finalScore: score,
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
