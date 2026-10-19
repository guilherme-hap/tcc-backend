import type { MeasurementMode } from '../interfaces/evaluation.interface.js';
import type { LoadTestOptionsInput } from '../schemas/loadTestOptions.schema.js';
import {
    DEFAULT_MAX_CPU_USAGE,
    DEFAULT_MAX_EVENT_LOOP_DELAY_MS,
    DEFAULT_REPETITIONS,
    DEFAULT_REST_INTERVAL_SECONDS,
    DEFAULT_STABILITY_THRESHOLD,
} from './loadTestLimits.js';

export interface MeasurementPlan {
    mode: MeasurementMode;
    repetitions: number;
    restIntervalSeconds: number;
    maxCpuUsage: number;
    maxEventLoopDelayMs: number;
    stabilityThreshold: number;
}

export function resolveMeasurementPlan(options?: LoadTestOptionsInput): MeasurementPlan {
    const mode = options?.mode ?? 'complete';

    return {
        mode,
        repetitions: mode === 'quick' ? 1 : options?.repetitions ?? DEFAULT_REPETITIONS,
        restIntervalSeconds: options?.restIntervalSeconds ?? DEFAULT_REST_INTERVAL_SECONDS,
        maxCpuUsage: options?.maxCpuUsage ?? DEFAULT_MAX_CPU_USAGE,
        maxEventLoopDelayMs: options?.maxEventLoopDelayMs ?? DEFAULT_MAX_EVENT_LOOP_DELAY_MS,
        stabilityThreshold: options?.stabilityThreshold ?? DEFAULT_STABILITY_THRESHOLD,
    };
}
