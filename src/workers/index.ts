import { evaluationQueue, EvaluationJob } from '../queues/EvaluationQueue.js';
import { ContractEvaluationWorker } from './ContractEvaluationWorker.js';
import { PerformanceEvaluationWorker } from './PerformanceEvaluationWorker.js';
import { SecurityEvaluationWorker } from './SecurityEvaluationWorker.js';
import { FullEvaluationWorker } from './FullEvaluationWorker.js';

const contractWorker = new ContractEvaluationWorker();
const performanceWorker = new PerformanceEvaluationWorker();
const securityWorker = new SecurityEvaluationWorker();
const fullWorker = new FullEvaluationWorker();

export function registerWorkers(): void {
    evaluationQueue.on('evaluation', (job: EvaluationJob) => {
        let promise: Promise<void> | undefined;

        switch (job.type) {
            case 'contract':
                promise = contractWorker.handle(job);
                break;
            case 'performance':
                promise = performanceWorker.handle(job);
                break;
            case 'security':
                promise = securityWorker.handle(job);
                break;
            case 'full':
                promise = fullWorker.handle(job);
                break;
            default:
                console.error(`[Workers] Unknown evaluation type: ${(job as any).type}`);
                return;
        }

        promise.catch((err) => {
            console.error(`[Workers] Unhandled rejection in ${job.type} worker for evaluation ${job.evaluationId}:`, err);
        });
    });
}
