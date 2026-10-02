import type { z } from 'zod';
import type { IPerformanceTarget } from '../interfaces/evaluation.interface.js';

export const DEFAULT_LOAD_LIMITS = {
    MAX_DURATION_SECONDS: 60,
    MAX_CONNECTIONS: 50,
    MAX_REQUESTS: 100_000,
    MAX_REQUESTS_PER_SECOND: 1_000,
} as const;

export const ELEVATED_LOAD_LIMITS = {
    MAX_DURATION_SECONDS: 300,
    MAX_CONNECTIONS: 500,
    MAX_REQUESTS: 1_000_000,
    MAX_REQUESTS_PER_SECOND: 10_000,
} as const;

export const MAX_TARGETS = 20;
export const MAX_TOTAL_DURATION_SECONDS = 600;
export const DEFAULT_DURATION_SECONDS = 10;

export function validateTotalDuration(
    data: { targets?: IPerformanceTarget[]; loadTestOptions?: { duration?: number } },
    ctx: z.RefinementCtx,
): void {
    if (!data.targets || data.targets.length === 0) return;

    const effectiveDuration = data.loadTestOptions?.duration ?? DEFAULT_DURATION_SECONDS;
    const totalDuration = data.targets.length * effectiveDuration;

    if (totalDuration > MAX_TOTAL_DURATION_SECONDS) {
        ctx.addIssue({
            code: 'custom',
            path: ['targets'],
            message: `Total load test duration (${totalDuration}s = ${data.targets.length} targets x ${effectiveDuration}s) exceeds the maximum allowed limit of ${MAX_TOTAL_DURATION_SECONDS}s.`,
        });
    }
}
