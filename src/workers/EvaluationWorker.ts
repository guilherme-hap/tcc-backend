import { AppError } from '../errors/AppError.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { createPillarContext } from '../pillars/createPillarContext.js';
import { PillarError, PillarSkipped } from '../pillars/PillarError.js';
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

function toFailure(evaluationId: string, pillar: PillarName, reason: unknown): AppError {
    if (reason instanceof AppError) {
        return reason;
    }
    console.error(`[Worker] Unexpected error in the ${pillar} pillar of evaluation ${evaluationId}:`, reason);
    return new AppError('EXECUTION_FAILED');
}

const PILLAR_LABELS: Record<PillarName, string> = {
    contract: 'Contrato',
    performance: 'Performance',
    security: 'Segurança',
};

export class EvaluationWorker {
    private lifecycle = new EvaluationLifecycleService();

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId } = job;

        try {
            await this.process(job);
        } catch (error: unknown) {
            console.error(`[Worker] Error processing evaluation ${evaluationId}:`, error);
            try {
                await this.lifecycle.fail(evaluationId, error instanceof AppError ? error : new AppError('EXECUTION_FAILED'));
            } catch (persistError) {
                console.error(`[Worker] Failed to persist FAILED status for ${evaluationId}:`, persistError);
            }
        }
    }

    private async process<T extends EvaluationType>(job: EvaluationJobOf<T>): Promise<void> {
        const pipeline = PIPELINES[job.type];
        const ctx = createPillarContext<EvaluationJobOf<T>['params']>(job.params);
        const runs: PillarRun[] = [];
        const results: Partial<PillarResults> = {};

        for (const stage of pipeline.stages) {
            const settledStage = await Promise.allSettled(stage.map(async (pillar) => {
                const blocked = pipeline.precondition?.(pillar.name, results);
                if (blocked) {
                    throw new PillarSkipped(blocked);
                }
                return pillar.run(ctx);
            }));
            settledStage.forEach((settled, index) => {
                const pillar = stage[index];
                if (settled.status === 'fulfilled') {
                    storeResult(results, pillar.column, settled.value.result);
                }
                runs.push({ pillar, settled });
            });
        }

        await this.conclude(job.evaluationId, runs, results, pipeline.weights(job.params));
    }

    private async conclude(
        evaluationId: string,
        runs: PillarRun[],
        results: Partial<PillarResults>,
        pillarWeights: IPillarScores,
    ): Promise<void> {
        const failedPillars: IFailedPillar[] = [];
        const pillarScores: IPillarScores = {};
        const scoring: IScoringParameters = { pillarWeights };
        let weightedSum = 0;

        for (const { pillar, settled } of runs) {
            if (settled.status === 'fulfilled') {
                pillarScores[pillar.name] = settled.value.score;
                Object.assign(scoring, settled.value.scoring);
                weightedSum += settled.value.score * (pillarWeights[pillar.name] ?? 0);
                continue;
            }
            const reason: unknown = settled.reason;
            if (reason instanceof PillarError) {
                Object.assign(results, reason.partialResults);
            }
            const failure = reason instanceof PillarSkipped ? reason.audit : toFailure(evaluationId, pillar.name, reason);
            failedPillars.push({ pillar: pillar.name, error: failure.message, code: failure.code });
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

        const sharedCause = failedPillars.every((fp) => fp.error === failedPillars[0].error);
        const message = sharedCause
            ? failedPillars[0].error
            : failedPillars.map((fp) => `${PILLAR_LABELS[fp.pillar]}: ${fp.error}`).join(' ');
        await this.lifecycle.fail(evaluationId, message, { ...results, failedPillars });
    }
}
