import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import type { ISaturation } from '../interfaces/evaluation.interface.js';
import { round } from './round.js';

const EVENT_LOOP_RESOLUTION_MS = 10;

export interface SaturationThresholds {
    maxCpuUsage: number;
    maxEventLoopDelayMs: number;
}

export function evaluateSaturation(
    cpuUsage: number,
    eventLoopDelayP99Ms: number,
    thresholds: SaturationThresholds,
): ISaturation {
    return {
        cpuUsage,
        eventLoopDelayP99Ms,
        exceeded: cpuUsage > thresholds.maxCpuUsage || eventLoopDelayP99Ms > thresholds.maxEventLoopDelayMs,
    };
}

export function startSaturationMonitor(thresholds: SaturationThresholds): { stop: () => ISaturation } {
    const histogram = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
    histogram.enable();
    const startedAt = performance.now();
    const startUsage = process.cpuUsage();

    return {
        stop: () => {
            const usage = process.cpuUsage(startUsage);
            const elapsedMs = performance.now() - startedAt;
            histogram.disable();

            const cpuUsage = elapsedMs > 0 ? (usage.user + usage.system) / 1000 / elapsedMs : 0;
            const eventLoopDelayMs = histogram.count > 0
                ? Math.max(0, histogram.percentile(99) / 1e6 - EVENT_LOOP_RESOLUTION_MS)
                : 0;

            return evaluateSaturation(round(cpuUsage, 3), round(eventLoopDelayMs, 2), thresholds);
        },
    };
}
