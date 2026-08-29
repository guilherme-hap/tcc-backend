import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SpectralService } from '../services/SpectralService.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { resolveBaseUrl } from '../utils/resolveBaseUrl.js';
import { calculateContractScore } from '../utils/calculateContractScore.js';
import { DEFAULT_WEIGHTS } from '../usecases/FullEvaluationUsecase.js';
import { EvaluationJob } from '../queues/EvaluationQueue.js';
import { IFullEvaluationRequest, IFailedPillar } from '../interfaces/evaluation.interface.js';

export class FullEvaluationWorker {
    private lifecycle: EvaluationLifecycleService;
    private spectralService: SpectralService;
    private autocannonService: AutocannonService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
        this.spectralService = new SpectralService();
        this.autocannonService = new AutocannonService();
    }

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId, params } = job;
        const {
            swaggerUrl,
            baseUrl,
            rulesConfig,
            loadTestOptions,
            weights,
        } = params as IFullEvaluationRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const targetBaseUrl = baseUrl?.trim()
                ? baseUrl.trim()
                : await resolveBaseUrl(swaggerUrl);

            const [contractSettled, performanceSettled] = await Promise.allSettled([
                this.spectralService.analyze(swaggerUrl, rulesConfig || {}),
                this.autocannonService.runLoadTest(targetBaseUrl, loadTestOptions || {}),
            ]);

            const contractOk = contractSettled.status === 'fulfilled';
            const performanceOk = performanceSettled.status === 'fulfilled';

            const contractResult = contractOk ? contractSettled.value : null;
            const performanceResult = performanceOk ? performanceSettled.value : null;

            if (contractOk && performanceOk) {
                const contractScore = calculateContractScore(contractResult!);
                const performanceScore = performanceResult!.score;

                const w = this.resolveWeights(weights);
                const finalScore = Math.round(
                    ((contractScore * w.contract) + (performanceScore * w.performance)) * 100
                ) / 100;

                await this.lifecycle.complete(evaluationId, {
                    spectralResult: contractResult,
                    autocannonResult: performanceResult,
                    finalScore,
                });
                return;
            }

            const failedPillars: IFailedPillar[] = [];

            if (!contractOk) {
                const reason = contractSettled as PromiseRejectedResult;
                failedPillars.push({
                    pillar: 'contract',
                    error: reason.reason?.message || String(reason.reason),
                });
            }

            if (!performanceOk) {
                const reason = performanceSettled as PromiseRejectedResult;
                failedPillars.push({
                    pillar: 'performance',
                    error: reason.reason?.message || String(reason.reason),
                });
            }

            if (contractOk || performanceOk) {
                await this.lifecycle.partial(evaluationId, {
                    spectralResult: contractResult,
                    autocannonResult: performanceResult,
                    finalScore: null,
                    failedPillars,
                });
                return;
            }

            const aggregatedError = failedPillars
                .map(fp => `${fp.pillar}: ${fp.error}`)
                .join('; ');
            await this.lifecycle.fail(evaluationId, aggregatedError);

        } catch (error: any) {
            console.error(`[FullWorker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                await this.lifecycle.fail(evaluationId, message);
            } catch (persistError) {
                console.error(`[FullWorker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }

    private resolveWeights(weights?: { contract?: number; performance?: number }) {
        if (!weights) return DEFAULT_WEIGHTS;

        return {
            contract: weights.contract ?? DEFAULT_WEIGHTS.contract,
            performance: weights.performance ?? DEFAULT_WEIGHTS.performance,
        };
    }
}
