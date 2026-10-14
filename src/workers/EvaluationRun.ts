import { AppError } from '../errors/AppError.js';
import type { EvaluationLifecycleService, EvaluationProgressPatch } from '../services/EvaluationLifecycleService.js';
import { PillarError } from '../pillars/PillarError.js';
import type { PillarColumn, PillarName, PillarOutcome, PillarProgressUpdate, PillarResults } from '../pillars/types.js';
import type {
    FailureCode,
    IEvaluationStep,
    IPillarScores,
    IScoreBreakdown,
    IScoringParameters,
} from '../interfaces/evaluation.interface.js';
import type { IAuditMessage } from '../messages/catalog.js';
import { round } from '../utils/round.js';
import { scorePart } from '../utils/scorePart.js';

interface PillarRef {
    name: PillarName;
    column: PillarColumn;
}

interface PillarFailure {
    pillar: PillarName;
    message: string;
    code: FailureCode;
}

type ResultColumns = { [K in PillarColumn]?: PillarResults[K] | null };

const PILLAR_LABELS: Record<PillarName, string> = {
    contract: 'Contrato',
    performance: 'Performance',
    security: 'Segurança',
};

function storeResult<C extends PillarColumn>(target: ResultColumns, column: C, value: PillarResults[C]): void {
    target[column] = value;
}

function now(): string {
    return new Date().toISOString();
}

export class EvaluationRun {
    readonly results: Partial<PillarResults> = {};
    private readonly pillarScores: IPillarScores = {};
    private readonly scoreBreakdown: IScoreBreakdown = {};
    private readonly scoring: IScoringParameters;
    private readonly failures: PillarFailure[] = [];
    private pending: EvaluationProgressPatch = {};
    private writing: Promise<void> | null = null;

    constructor(
        private readonly evaluationId: string,
        private readonly lifecycle: EvaluationLifecycleService,
        private readonly steps: IEvaluationStep[],
        private readonly pillarWeights: IPillarScores,
    ) {
        this.scoring = { pillarWeights };
    }

    begin(pillar: PillarRef): void {
        Object.assign(this.step(pillar), { status: 'RUNNING', startedAt: now() });
        this.save({});
    }

    report(pillar: PillarRef, update: PillarProgressUpdate): void {
        const patch: EvaluationProgressPatch = {};
        if (update.result !== undefined) {
            storeResult(this.results, pillar.column, update.result);
            storeResult(patch, pillar.column, update.result);
        }
        if (update.progress !== undefined) {
            this.step(pillar).progress = update.progress;
        }
        this.save(patch);
    }

    succeed(pillar: PillarRef, outcome: PillarOutcome): void {
        storeResult(this.results, pillar.column, outcome.result);
        this.pillarScores[pillar.name] = outcome.score;
        this.scoreBreakdown[pillar.name] = outcome.breakdown;
        Object.assign(this.scoring, outcome.scoring);
        this.finish(pillar, 'COMPLETED');

        const patch: EvaluationProgressPatch = {
            pillarScores: { ...this.pillarScores },
            scoring: { ...this.scoring },
            scoreBreakdown: { ...this.scoreBreakdown },
        };
        storeResult(patch, pillar.column, outcome.result);
        this.save(patch);
    }

    skip(pillar: PillarRef, audit: IAuditMessage): void {
        this.failures.push({ pillar: pillar.name, message: audit.message, code: audit.code });
        this.finish(pillar, 'SKIPPED', audit.message, audit.code);
        this.save({});
    }

    fail(pillar: PillarRef, reason: unknown): void {
        const patch: EvaluationProgressPatch = {};
        if (reason instanceof PillarError) {
            Object.assign(this.results, reason.partialResults);
            Object.assign(patch, reason.partialResults);
        }
        const failure = this.toFailure(pillar.name, reason);
        this.failures.push({ pillar: pillar.name, message: failure.message, code: failure.code });
        this.finish(pillar, 'FAILED', failure.message, failure.code);
        this.save(patch);
    }

    async conclude(): Promise<void> {
        await this.writing;
        const steps = this.snapshotSteps();

        if (this.failures.length === 0) {
            const finalScore = this.steps.reduce(
                (sum, step) => sum + (this.pillarScores[step.pillar] ?? 0) * (this.pillarWeights[step.pillar] ?? 0),
                0,
            );
            await this.lifecycle.complete(this.evaluationId, {
                ...this.results,
                finalScore: round(finalScore, 2),
                pillarScores: this.pillarScores,
                scoring: this.scoring,
                scoreBreakdown: {
                    final: (Object.keys(this.pillarWeights) as PillarName[]).map((name) => (
                        scorePart(name, this.pillarWeights[name] ?? 0, this.pillarScores[name] ?? 0)
                    )),
                    ...this.scoreBreakdown,
                },
                steps,
            });
            return;
        }

        if (this.failures.length < this.steps.length) {
            await this.lifecycle.partial(this.evaluationId, {
                ...this.results,
                finalScore: null,
                pillarScores: this.pillarScores,
                scoring: this.scoring,
                scoreBreakdown: this.scoreBreakdown,
                steps,
            });
            return;
        }

        const [first] = this.failures;
        const sharedCause = this.failures.every((failure) => failure.message === first.message);
        const failure = sharedCause
            ? { message: first.message, code: first.code }
            : new AppError('EVALUATION_PILLARS_FAILED', {
                details: this.failures.map((item) => `${PILLAR_LABELS[item.pillar]}: ${item.message}`).join(' '),
            });
        await this.lifecycle.fail(this.evaluationId, failure, { ...this.results, steps });
    }

    private step(pillar: PillarRef): IEvaluationStep {
        const step = this.steps.find((item) => item.pillar === pillar.name);
        if (!step) {
            throw new Error(`Pillar ${pillar.name} is not part of the evaluation steps`);
        }
        return step;
    }

    private finish(pillar: PillarRef, status: IEvaluationStep['status'], error?: string, code?: FailureCode): void {
        const step = this.step(pillar);
        delete step.progress;
        Object.assign(step, { status, finishedAt: now(), ...(code && { error, code }) });
    }

    private toFailure(pillar: PillarName, reason: unknown): AppError {
        if (reason instanceof AppError) {
            return reason;
        }
        console.error(`[Worker] Unexpected error in the ${pillar} pillar of evaluation ${this.evaluationId}:`, reason);
        return new AppError('EXECUTION_FAILED');
    }

    private snapshotSteps(): IEvaluationStep[] {
        return this.steps.map((step) => ({ ...step, ...(step.progress && { progress: { ...step.progress } }) }));
    }

    private save(patch: EvaluationProgressPatch): void {
        Object.assign(this.pending, patch, { steps: this.snapshotSteps() });
        this.writing ??= this.flush();
    }

    private async flush(): Promise<void> {
        while (Object.keys(this.pending).length > 0) {
            const patch = this.pending;
            this.pending = {};
            try {
                await this.lifecycle.progress(this.evaluationId, patch);
            } catch (error: unknown) {
                const detail = error instanceof Error ? error.message : String(error);
                console.error(`[Worker] Failed to save the progress of evaluation ${this.evaluationId}:`, detail);
            }
        }
        this.writing = null;
    }
}
