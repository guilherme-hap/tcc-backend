import { evaluationQueue } from '../queues/EvaluationQueue.js';
import type { EvaluationJob } from '../queues/EvaluationQueue.js';
import { ContractEvaluationWorker } from './ContractEvaluationWorker.js';
import { PerformanceEvaluationWorker } from './PerformanceEvaluationWorker.js';
import { FullEvaluationWorker } from './FullEvaluationWorker.js';

const contractWorker = new ContractEvaluationWorker();
const performanceWorker = new PerformanceEvaluationWorker();
const fullWorker = new FullEvaluationWorker();

function buildHandler(type: string): (job: EvaluationJob) => Promise<void> {
    switch (type) {
        case 'contract':
            return (job) => contractWorker.handle(job);
        case 'performance':
            return (job) => performanceWorker.handle(job);
        case 'full':
            return (job) => fullWorker.handle(job);
        default:
            throw new Error(`Unknown evaluation type: ${type}`);
    }
}

export async function registerWorkers(): Promise<void> {
    await evaluationQueue.recoverOrphanedJobs();

    const types = ['contract', 'performance', 'full'] as const;

    for (const type of types) {
        const envKey = `${type.toUpperCase()}_WORKER_CONCURRENCY`;
        const concurrency = Number(process.env[envKey]) || (type === 'contract' ? 10 : 2);
        await evaluationQueue.listen(type, concurrency, buildHandler(type));
    }
}
