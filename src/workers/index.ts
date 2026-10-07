import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { EvaluationWorker } from './EvaluationWorker.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import type { EvaluationJob, EvaluationType } from '../interfaces/evaluation.interface.js';

const worker = new EvaluationWorker();
const lifecycle = new EvaluationLifecycleService();

async function dispatch(job: EvaluationJob): Promise<void> {
    if (!(await lifecycle.start(job.evaluationId))) {
        console.log(`[Worker] Skipping job for evaluation ${job.evaluationId}: already finished`);
        return;
    }
    await worker.handle(job);
}

export async function registerWorkers(): Promise<void> {
    await evaluationQueue.recoverOrphanedJobs();

    const types = ['contract', 'performance', 'security', 'full'] as const satisfies readonly EvaluationType[];

    await evaluationQueue.start(types.map((type) => ({
        type,
        concurrency: Number(process.env[`${type.toUpperCase()}_WORKER_CONCURRENCY`]) || (['contract', 'security'].includes(type) ? 10 : 2),
        handler: dispatch,
    })));
}
