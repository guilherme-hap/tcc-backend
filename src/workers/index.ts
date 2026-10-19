import { evaluationQueue } from '../queues/EvaluationQueue.js';
import { EvaluationWorker } from './EvaluationWorker.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { initialSteps } from '../pillars/pipelines.js';
import { AppError } from '../errors/AppError.js';
import { loadWorkerMode } from '../config/processRole.js';
import type { ProcessRole } from '../config/processRole.js';
import type { EvaluationJob, EvaluationType } from '../interfaces/evaluation.interface.js';
import type { QueueConsumer } from '../queues/EvaluationQueue.js';

const worker = new EvaluationWorker();
const lifecycle = new EvaluationLifecycleService();

async function dispatch(job: EvaluationJob): Promise<void> {
    if (!(await lifecycle.start(job.evaluationId, initialSteps(job.type)))) {
        console.log(`[Worker] Skipping job for evaluation ${job.evaluationId}: already finished`);
        return;
    }
    await worker.handle(job);
}

async function giveUp(job: EvaluationJob): Promise<void> {
    await lifecycle.fail(job.evaluationId, new AppError('EXECUTION_INTERRUPTED'));
}

function concurrencyOf(type: EvaluationType): number {
    return Number(process.env[`${type.toUpperCase()}_WORKER_CONCURRENCY`]) || (['contract', 'security'].includes(type) ? 10 : 2);
}

function consumersFor(role: ProcessRole): QueueConsumer[] {
    const consumer = (types: EvaluationType[], concurrency: number): QueueConsumer => ({
        types,
        concurrency,
        handler: dispatch,
        onGiveUp: giveUp,
    });

    if (role === 'load-worker') return [consumer(['performance', 'full'], 1)];

    const consumers = [consumer(['contract'], concurrencyOf('contract')), consumer(['security'], concurrencyOf('security'))];
    if (loadWorkerMode() === 'embedded') {
        consumers.push(consumer(['performance'], concurrencyOf('performance')), consumer(['full'], concurrencyOf('full')));
    }
    return consumers;
}

export async function registerWorkers(role: ProcessRole = 'api'): Promise<void> {
    const consumers = consumersFor(role);

    await evaluationQueue.recoverOrphanedJobs(consumers.flatMap((consumer) => consumer.types));

    const orphaned = await lifecycle.failOrphaned(new AppError('EXECUTION_INTERRUPTED'));
    if (orphaned > 0) {
        console.log(`[Worker] Failed ${orphaned} evaluations left without a job`);
    }

    await evaluationQueue.start(consumers);
}
