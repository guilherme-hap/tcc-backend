import type { ILatencySummary } from '../interfaces/evaluation.interface.js';
import { round } from './round.js';

const P95_MIN_SAMPLE_SIZE = 20;
const P99_MIN_SAMPLE_SIZE = 100;
const P99_9_MIN_SAMPLE_SIZE = 1000;

export interface LatencySamples {
    histogram: Uint32Array;
    count: number;
    sum: number;
}

export function createLatencySamples(maxMs: number): LatencySamples {
    return { histogram: new Uint32Array(maxMs + 1), count: 0, sum: 0 };
}

export function recordLatency(samples: LatencySamples, responseTime: number): void {
    const slot = Math.min(Math.round(responseTime), samples.histogram.length - 1);
    samples.histogram[slot]++;
    samples.count++;
    samples.sum += responseTime;
}

export function mergeLatencySamples(a: LatencySamples | null, b: LatencySamples): LatencySamples {
    const length = Math.max(a?.histogram.length ?? 0, b.histogram.length);
    const merged = createLatencySamples(length - 1);
    for (const source of a ? [a, b] : [b]) {
        source.histogram.forEach((count, ms) => {
            merged.histogram[ms] += count;
        });
        merged.count += source.count;
        merged.sum += source.sum;
    }
    return merged;
}

function latencyAtRank(histogram: Uint32Array, rank: number): number {
    let cumulative = 0;

    for (let ms = 0; ms < histogram.length; ms++) {
        cumulative += histogram[ms];
        if (cumulative >= rank) return ms;
    }

    return histogram.length - 1;
}

export function summarizeLatency(samples: LatencySamples | null): ILatencySummary | null {
    if (samples === null || samples.count === 0) return null;
    const { histogram, count } = samples;

    const percentile = (perMille: number): number => latencyAtRank(histogram, Math.ceil((count * perMille) / 1000));

    return {
        min: latencyAtRank(histogram, 1),
        mean: round(samples.sum / count, 2),
        p50: percentile(500),
        p95: count >= P95_MIN_SAMPLE_SIZE ? percentile(950) : null,
        p99: count >= P99_MIN_SAMPLE_SIZE ? percentile(990) : null,
        p99_9: count >= P99_9_MIN_SAMPLE_SIZE ? percentile(999) : null,
        max: latencyAtRank(histogram, count),
    };
}
