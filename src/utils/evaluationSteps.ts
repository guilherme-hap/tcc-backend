import type { Evaluation } from '../entities/Evaluation.js';
import type { IEvaluationStep } from '../interfaces/evaluation.interface.js';

const TERMINAL_STEP_STATUSES = new Set<IEvaluationStep['status']>(['COMPLETED', 'FAILED', 'SKIPPED', 'INTERRUPTED']);

export function waitingForLoadTest(evaluation: Pick<Evaluation, 'status' | 'steps'>): boolean {
    if (evaluation.status !== 'RUNNING' || !evaluation.steps) return false;

    const open = evaluation.steps.filter((step) => !TERMINAL_STEP_STATUSES.has(step.status));
    const working = open.some((step) => step.startedAt && !step.finishedAt);
    const waiting = open.some((step) => step.queuedAt && !step.startedAt);
    return waiting && !working;
}

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
