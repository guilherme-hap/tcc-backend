import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import { evaluationQueue, EvaluationJob } from '../queues/EvaluationQueue.js';
import { AppError } from '../errors/AppError.js';

export async function enqueueOrFail(
    lifecycle: EvaluationLifecycleService,
    job: EvaluationJob,
): Promise<void> {
    try {
        await evaluationQueue.enqueue(job);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[Enqueue] Failed for evaluation ${job.evaluationId}:`, err);
        await lifecycle
            .fail(job.evaluationId, `Failed to enqueue ${job.type} evaluation: ${detail}`)
            .catch((e) => console.error(`[Enqueue] Failed to persist FAILED for ${job.evaluationId}:`, e));
        throw new AppError(`Could not queue ${job.type} evaluation. Please try again later.`, 500);
    }
}
