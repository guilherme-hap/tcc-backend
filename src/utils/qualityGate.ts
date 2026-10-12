import type { Evaluation } from '../entities/Evaluation.js';

export function evaluationPassed(
    evaluation: Pick<Evaluation, 'status' | 'finalScore' | 'requestSettings'>,
): boolean | null {
    const minScore = evaluation.requestSettings?.minScore;
    if (minScore === undefined) return null;
    if (evaluation.status === 'PENDING' || evaluation.status === 'RUNNING') return null;

    return evaluation.status === 'COMPLETED' && evaluation.finalScore !== null && evaluation.finalScore >= minScore;
}
