import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { SpectralService } from '../services/SpectralService.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { SecurityService } from '../services/SecurityService.js';
import { fetchOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import { runPerformanceTargets, PerformancePillarError, RunPerformanceTargetsOutput } from '../utils/runPerformanceTargets.js';
import { resolveBaseUrlFromSpec } from '../utils/resolveBaseUrl.js';
import { calculateContractScore } from '../utils/calculateContractScore.js';
import { calculateSecurityScore } from '../utils/calculateSecurityScore.js';
import { DEFAULT_WEIGHTS } from '../utils/weights.js';
import { EvaluationJob } from '../queues/EvaluationQueue.js';
import { IFullEvaluationRequest, IFailedPillar, IPerformanceTargetResult } from '../interfaces/evaluation.interface.js';

function getPerformanceResults(
    settled: PromiseSettledResult<RunPerformanceTargetsOutput>,
): IPerformanceTargetResult[] | null {
    if (settled.status === 'fulfilled') {
        return settled.value.performanceResults;
    }
    const reason = settled.reason;
    if (reason instanceof PerformancePillarError) {
        return reason.performanceResults;
    }
    return null;
}

export class FullEvaluationWorker {
    private lifecycle: EvaluationLifecycleService;
    private spectralService: SpectralService;
    private autocannonService: AutocannonService;
    private securityService: SecurityService;

    constructor() {
        this.lifecycle = new EvaluationLifecycleService();
        this.spectralService = new SpectralService();
        this.autocannonService = new AutocannonService();
        this.securityService = new SecurityService();
    }

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId, params } = job;
        const {
            openApiUrl,
            apiBaseUrl,
            targets,
            rulesConfig,
            loadTestOptions,
            weights,
            severityWeights,
        } = params as IFullEvaluationRequest;

        try {
            await this.lifecycle.start(evaluationId);

            const openApiContent = await fetchOpenApiContent(openApiUrl);
            const spec = openApiContent.data;

            const runSecurityPillar = async () => {
                const securityTargetUrl = apiBaseUrl?.trim()
                    ? apiBaseUrl.trim()
                    : resolveBaseUrlFromSpec(spec, openApiUrl);
                return this.securityService.analyze(securityTargetUrl);
            };

            const [contractSettled, performanceSettled, securitySettled] = await Promise.allSettled([
                this.spectralService.analyze(openApiUrl, rulesConfig || {}, openApiContent),
                runPerformanceTargets({
                    openApiUrl,
                    apiBaseUrl,
                    targets,
                    loadTestOptions,
                    spec,
                    autocannonService: this.autocannonService,
                }),
                runSecurityPillar(),
            ]);

            const contractOk = contractSettled.status === 'fulfilled';
            const performanceOk = performanceSettled.status === 'fulfilled';
            const securityOk = securitySettled.status === 'fulfilled';

            const contractResult = contractOk ? contractSettled.value : null;
            const performanceData = performanceOk ? performanceSettled.value : null;
            const securityResult = securityOk ? securitySettled.value : null;

            const performanceResults = getPerformanceResults(performanceSettled);

            if (contractOk && performanceOk && securityOk) {
                const contractScore = calculateContractScore(contractResult!, severityWeights);
                const performanceScore = performanceData!.score;
                const securityScore = calculateSecurityScore(securityResult!);

                const w = this.resolveWeights(weights);
                const finalScore = Math.round(
                    ((contractScore * w.contract) + (performanceScore * w.performance) + (securityScore * w.security)) * 100
                ) / 100;

                await this.lifecycle.complete(evaluationId, {
                    spectralResult: contractResult,
                    performanceResults,
                    securityResult: securityResult,
                    finalScore,
                    appliedWeights: w,
                });
                return;
            }

            const settledPillars = [
                { pillar: 'contract', settled: contractSettled },
                { pillar: 'performance', settled: performanceSettled },
                { pillar: 'security', settled: securitySettled },
            ] as const;

            const failedPillars: IFailedPillar[] = [];
            for (const { pillar, settled } of settledPillars) {
                if (settled.status === 'rejected') {
                    failedPillars.push({
                        pillar,
                        error: settled.reason?.message || String(settled.reason),
                    });
                }
            }

            if (contractOk || performanceOk || securityOk) {
                await this.lifecycle.partial(evaluationId, {
                    spectralResult: contractResult,
                    performanceResults,
                    securityResult: securityResult,
                    finalScore: null,
                    failedPillars,
                    appliedWeights: this.resolveWeights(weights),
                });
                return;
            }

            const aggregatedError = failedPillars
                .map(fp => `${fp.pillar}: ${fp.error}`)
                .join('; ');
            await this.lifecycle.fail(evaluationId, aggregatedError, { performanceResults });

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

    private resolveWeights(weights?: { contract?: number; performance?: number; security?: number }) {
        if (!weights) return DEFAULT_WEIGHTS;

        return {
            contract: weights.contract ?? DEFAULT_WEIGHTS.contract,
            performance: weights.performance ?? DEFAULT_WEIGHTS.performance,
            security: weights.security ?? DEFAULT_WEIGHTS.security,
        };
    }
}
