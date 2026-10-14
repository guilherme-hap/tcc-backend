import { AppError } from '../errors/AppError.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { createPillarContext } from '../pillars/createPillarContext.js';
import { initialSteps, PIPELINES } from '../pillars/pipelines.js';
import type { EvaluationJob, EvaluationJobOf, EvaluationType } from '../interfaces/evaluation.interface.js';
import { EvaluationRun } from './EvaluationRun.js';

export class EvaluationWorker {
    private lifecycle = new EvaluationLifecycleService();

    async handle(job: EvaluationJob): Promise<void> {
        const { evaluationId } = job;

        try {
            await this.process(job);
        } catch (error: unknown) {
            console.error(`[Worker] Error processing evaluation ${evaluationId}:`, error);
            await this.lifecycle.fail(evaluationId, error instanceof AppError ? error : new AppError('EXECUTION_FAILED'));
        }
    }

    private async process<T extends EvaluationType>(job: EvaluationJobOf<T>): Promise<void> {
        const pipeline = PIPELINES[job.type];
        const resources = createPillarContext<EvaluationJobOf<T>['params']>(job.params);
        const run = new EvaluationRun(job.evaluationId, this.lifecycle, initialSteps(job.type), pipeline.weights(job.params));

        for (const stage of pipeline.stages) {
            await Promise.all(stage.map(async (pillar) => {
                const blocked = pipeline.precondition?.(pillar.name, run.results);
                if (blocked) {
                    run.skip(pillar, blocked);
                    return;
                }
                run.begin(pillar);
                try {
                    run.succeed(pillar, await pillar.run({ ...resources, report: (update) => run.report(pillar, update) }));
                } catch (reason: unknown) {
                    run.fail(pillar, reason);
                }
            }));
        }

        await run.conclude();
    }
}
