import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { createPillarContext } from '../pillars/createPillarContext.js';
import { PillarError } from '../pillars/PillarError.js';
import { PIPELINES } from '../pillars/pipelines.js';
import type { PillarColumn, PillarName, PillarOutcome, PillarResults } from '../pillars/types.js';
import type { EvaluationJob, EvaluationJobOf, EvaluationType, IFailedPillar } from '../interfaces/evaluation.interface.js';
import type { EvaluationWeights } from '../utils/weights.js';

interface PillarRun {
    pillar: { name: PillarName; column: PillarColumn };
    settled: PromiseSettledResult<PillarOutcome>;
}

function storeResult<C extends PillarColumn>(results: Partial<PillarResults>, column: C, value: PillarResults[C]): void {
    results[column] = value;
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function errorMessageOf(reason: unknown): string {
    return (reason instanceof Error && reason.message) || String(reason);
}

export class EvaluationWorker {
    private lifecycle = new EvaluationLifecycleService();

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId } = job;

        try {
            await this.process(job);
        } catch (error: unknown) {
            console.error(`[Worker] Error processing evaluation ${evaluationId}:`, error);
            try {
                const message = error instanceof Error ? error.message : String(error);
                await this.lifecycle.fail(evaluationId, message);
            } catch (persistError) {
                console.error(`[Worker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }

    private async process<T extends EvaluationType>(job: EvaluationJobOf<T>): Promise<void> {
        const pipeline = PIPELINES[job.type];
        const ctx = createPillarContext<EvaluationJobOf<T>['params']>(job.params);

        const runs: PillarRun[] = (
            await Promise.allSettled(pipeline.pillars.map((pillar) => pillar.run(ctx)))
        ).map((settled, index) => ({ pillar: pipeline.pillars[index], settled }));

        const appliedWeights = pipeline.weights ? pipeline.weights(job.params) : null;

        await this.conclude(job.evaluationId, runs, appliedWeights, pipeline.pillars.length === 1);
    }

    private async conclude(
        evaluationId: string,
        runs: PillarRun[],
        appliedWeights: EvaluationWeights | null,
        singlePillar: boolean,
    ): Promise<void> {
        const results: Partial<PillarResults> = {};
        const failedPillars: IFailedPillar[] = [];
        let weightedSum = 0;

        for (const { pillar, settled } of runs) {
            if (settled.status === 'fulfilled') {
                storeResult(results, pillar.column, settled.value.result);
                weightedSum += settled.value.score * (appliedWeights ? appliedWeights[pillar.name] : 1);
                continue;
            }
            if (settled.reason instanceof PillarError) {
                Object.assign(results, settled.reason.partialResults);
            }
            failedPillars.push({ pillar: pillar.name, error: errorMessageOf(settled.reason) });
        }

        if (failedPillars.length === 0) {
            await this.lifecycle.complete(evaluationId, {
                ...results,
                finalScore: round2(weightedSum),
                ...(appliedWeights && { appliedWeights }),
            });
            return;
        }

        if (failedPillars.length < runs.length) {
            await this.lifecycle.partial(evaluationId, {
                ...results,
                finalScore: null,
                failedPillars,
                ...(appliedWeights && { appliedWeights }),
            });
            return;
        }

        const message = singlePillar
            ? failedPillars[0].error
            : failedPillars.map((fp) => `${fp.pillar}: ${fp.error}`).join('; ');
        await this.lifecycle.fail(evaluationId, message, results);
    }
}
