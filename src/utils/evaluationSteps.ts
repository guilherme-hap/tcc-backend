import type { Evaluation } from '../entities/Evaluation.js';
import type { IEvaluationStep } from '../interfaces/evaluation.interface.js';

export function visibleSteps(evaluation: Pick<Evaluation, 'status' | 'steps'>): IEvaluationStep[] | null {
    if (!evaluation.steps || evaluation.status === 'PENDING' || evaluation.status === 'RUNNING') {
        return evaluation.steps;
    }

    return evaluation.steps.map((step): IEvaluationStep => {
        if (step.status !== 'PENDING' && step.status !== 'RUNNING') return step;

        const { progress: _progress, ...unfinished } = step;
        return { ...unfinished, status: 'INTERRUPTED' };
    });
}
