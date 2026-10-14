import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { EvaluationWorker } from './EvaluationWorker.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { AppError } from '../errors/AppError.js';
import { EVALUATION_TYPES } from '../interfaces/evaluation.interface.js';
import type { EvaluationJob } from '../interfaces/evaluation.interface.js';

const worker = new EvaluationWorker();
const lifecycle = new EvaluationLifecycleService();

async function dispatch(job: EvaluationJob): Promise<void> {
    if (!(await lifecycle.start(job.evaluationId))) {
        console.log(`[Worker] Skipping job for evaluation ${job.evaluationId}: already finished`);
        return;
    }
    await worker.handle(job);
}

async function giveUp(job: EvaluationJob): Promise<void> {
    await lifecycle.fail(job.evaluationId, new AppError('EXECUTION_INTERRUPTED'));
}

export async function registerWorkers(): Promise<void> {
    await evaluationQueue.recoverOrphanedJobs();

    const orphaned = await lifecycle.failOrphaned(new AppError('EXECUTION_INTERRUPTED'));
    if (orphaned > 0) {
        console.log(`[Worker] Failed ${orphaned} evaluations left without a job`);
    }

    await evaluationQueue.start(EVALUATION_TYPES.map((type) => ({
        type,
        concurrency: Number(process.env[`${type.toUpperCase()}_WORKER_CONCURRENCY`]) || (['contract', 'security'].includes(type) ? 10 : 2),
        handler: dispatch,
        onGiveUp: giveUp,
    })));
}
