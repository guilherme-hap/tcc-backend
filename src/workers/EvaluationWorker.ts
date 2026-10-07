import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { createPillarContext } from '../pillars/createPillarContext.js';
import { PillarError } from '../pillars/PillarError.js';
import { PIPELINES } from '../pillars/pipelines.js';
import type { PillarColumn, PillarName, PillarOutcome, PillarResults } from '../pillars/types.js';
import type {
    EvaluationJob,
    EvaluationJobOf,
    EvaluationType,
    IFailedPillar,
    IPillarScores,
    IScoringParameters,
} from '../interfaces/evaluation.interface.js';

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
        const runs: PillarRun[] = [];

        for (const stage of pipeline.stages) {
            const settledStage = await Promise.allSettled(stage.map((pillar) => pillar.run(ctx)));
            settledStage.forEach((settled, index) => runs.push({ pillar: stage[index], settled }));
        }

        await this.conclude(job.evaluationId, runs, pipeline.weights(job.params));
    }

    private async conclude(evaluationId: string, runs: PillarRun[], pillarWeights: IPillarScores): Promise<void> {
        const results: Partial<PillarResults> = {};
        const failedPillars: IFailedPillar[] = [];
        const pillarScores: IPillarScores = {};
        const scoring: IScoringParameters = { pillarWeights };
        let weightedSum = 0;

        for (const { pillar, settled } of runs) {
            if (settled.status === 'fulfilled') {
                storeResult(results, pillar.column, settled.value.result);
                pillarScores[pillar.name] = settled.value.score;
                Object.assign(scoring, settled.value.scoring);
                weightedSum += settled.value.score * (pillarWeights[pillar.name] ?? 0);
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
                pillarScores,
                scoring,
            });
            return;
        }

        if (failedPillars.length < runs.length) {
            await this.lifecycle.partial(evaluationId, {
                ...results,
                finalScore: null,
                failedPillars,
                pillarScores,
                scoring,
            });
            return;
        }

        const message = runs.length === 1
            ? failedPillars[0].error
            : failedPillars.map((fp) => `${fp.pillar}: ${fp.error}`).join('; ');
        await this.lifecycle.fail(evaluationId, message, results);
    }
}
