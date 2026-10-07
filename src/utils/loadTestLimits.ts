import type { z } from 'zod';
import type { IPerformanceTarget } from '../interfaces/evaluation.interface.js';
import { isMutatingMethod } from './httpMethodUtils.js';

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
export const DEFAULT_MUTATING_DURATION_SECONDS = 5;
export const DEFAULT_TARGET_LATENCY_MS = 1000;
export const FRUSTRATED_LATENCY_MULTIPLIER = 4;

export function defaultDurationFor(method?: string): number {
    return isMutatingMethod(method) ? DEFAULT_MUTATING_DURATION_SECONDS : DEFAULT_DURATION_SECONDS;
}

export function apdexWindowIssue(durationSeconds: number, targetLatencyMs: number): string | null {
    const frustratedSeconds = (FRUSTRATED_LATENCY_MULTIPLIER * targetLatencyMs) / 1000;
    if (durationSeconds > frustratedSeconds) return null;

    return `duration (${durationSeconds}s) must be greater than ${FRUSTRATED_LATENCY_MULTIPLIER} x targetLatency (${frustratedSeconds}s); a shorter test cannot classify an unresponsive target as frustrated.`;
}

export function validateTargetApdexWindow(
    data: {
        targets: { method?: string }[];
        loadTestOptions?: { duration?: number; targetLatency?: number; method?: string };
    },
    ctx: z.RefinementCtx,
): void {
    const options = data.loadTestOptions;
    if (options?.duration !== undefined) return;

    const targetLatency = options?.targetLatency ?? DEFAULT_TARGET_LATENCY_MS;
    const inheritedDuration = defaultDurationFor(options?.method);

    data.targets.forEach((target, index) => {
        const duration = defaultDurationFor(target.method ?? options?.method);
        if (duration === inheritedDuration) return;

        const issue = apdexWindowIssue(duration, targetLatency);
        if (issue) {
            ctx.addIssue({
                code: 'custom',
                path: ['targets', index, 'method'],
                message: `${issue} Set loadTestOptions.duration explicitly (${duration}s is the default for this method).`,
            });
        }
    });
}

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
