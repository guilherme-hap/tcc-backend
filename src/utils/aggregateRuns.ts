import type {
    IAutocannonResult,
    IAutocannonRunResult,
    IDispersion,
    ILatencySummary,
    IPerformanceRun,
    StabilityStatus,
} from '../interfaces/evaluation.interface.js';
import { auditMessage } from '../messages/catalog.js';
import type { IAuditMessage } from '../messages/catalog.js';
import { round } from './round.js';

export interface StabilityAssessment {
    status: StabilityStatus;
    coefficientOfVariation: number | null;
    dispersion: IDispersion | null;
    runsCounted: number;
}

function mean(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
}

function sampleStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const average = mean(values);
    return Math.sqrt(sum(values.map((value) => (value - average) ** 2)) / (values.length - 1));
}

export function summarizeDispersion(values: number[]): IDispersion | null {
    if (values.length < 2) return null;
    return {
        stddev: round(sampleStdDev(values), 2),
        min: round(Math.min(...values), 2),
        max: round(Math.max(...values), 2),
    };
}

export function runApdex(run: IPerformanceRun): number | null {
    if (run.result === null) return 0;
    return run.result.score;
}

export function targetRunValues(runs: IPerformanceRun[]): (number | null)[] {
    return runs.map(runApdex);
}

export function pillarRunScores(valuesByTarget: (number | null)[][], repetitions: number): (number | null)[] {
    return Array.from({ length: repetitions }, (_, runIndex) => {
        const counted = valuesByTarget
            .map((values) => values[runIndex])
            .filter((value): value is number => value !== undefined && value !== null);
        return counted.length > 0 ? round(mean(counted), 2) : null;
    });
}

export function assessStability(runScores: (number | null)[], threshold: number): StabilityAssessment {
    const values = runScores.filter((score): score is number => score !== null);
    if (values.length < 2) {
        return { status: 'not_measured', coefficientOfVariation: null, dispersion: null, runsCounted: values.length };
    }

    const average = mean(values);
    const coefficientOfVariation = average > 0 ? round(sampleStdDev(values) / average, 4) : null;

    return {
        status: coefficientOfVariation !== null && coefficientOfVariation > threshold ? 'low' : 'stable',
        coefficientOfVariation,
        dispersion: summarizeDispersion(values),
        runsCounted: values.length,
    };
}

function meanOfNonNull(values: (number | null)[]): number | null {
    const present = values.filter((value): value is number => value !== null);
    return present.length > 0 ? round(mean(present), 2) : null;
}

function aggregateLatency(results: IAutocannonRunResult[]): ILatencySummary | null {
    const summaries = results.map((result) => result.latency).filter((latency): latency is ILatencySummary => latency !== null);
    if (summaries.length === 0) return null;

    const field = (key: keyof ILatencySummary) => meanOfNonNull(summaries.map((latency) => latency[key]));

    return {
        min: field('min')!,
        mean: field('mean')!,
        p50: field('p50')!,
        p95: field('p95'),
        p99: field('p99'),
        p99_9: field('p99_9'),
        max: field('max')!,
    };
}

function sumStatusCodes(results: IAutocannonRunResult[]): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const result of results) {
        for (const [code, count] of Object.entries(result.statusCodes)) {
            totals[code] = (totals[code] ?? 0) + count;
        }
    }
    return totals;
}

function numericParam(warnings: IAuditMessage[], key: string): number[] {
    return warnings.map((warning) => Number(warning.params?.[key] ?? 0));
}

function aggregateWarnings(
    results: IAutocannonRunResult[],
    totalRuns: number,
    runsCounted: number,
): IAuditMessage[] {
    const byCode = new Map<string, IAuditMessage[]>();
    for (const warning of results.flatMap((result) => result.warnings)) {
        byCode.set(warning.code, [...(byCode.get(warning.code) ?? []), warning]);
    }

    const aggregated: IAuditMessage[] = [];
    for (const [code, group] of byCode) {
        switch (code) {
            case 'PERF_CLIENT_BIAS':
                break;
            case 'PERF_SMALL_SAMPLE':
                aggregated.push(auditMessage('PERF_SMALL_SAMPLE', { sampleSize: Math.min(...numericParam(group, 'sampleSize')) }));
                break;
            case 'PERF_EXCLUDED_4XX':
                aggregated.push(auditMessage('PERF_EXCLUDED_4XX', { count: sum(numericParam(group, 'count')) }));
                break;
            case 'PERF_NO_RESPONSE':
                aggregated.push(auditMessage('PERF_NO_RESPONSE', { attempts: sum(numericParam(group, 'attempts')) }));
                break;
            case 'PERF_NO_VALID_SAMPLE':
                if (runsCounted === 0) aggregated.push(group[0]);
                break;
            default:
                aggregated.push(group[0]);
        }
    }

    const biased = results.filter((result) => result.saturation.exceeded).length;
    if (biased > 0) {
        aggregated.push(auditMessage('PERF_CLIENT_BIAS_RUNS', { affected: biased, total: totalRuns }));
    }
    if (runsCounted > 0 && runsCounted < totalRuns) {
        aggregated.push(auditMessage('PERF_RUNS_EXCLUDED', { counted: runsCounted, total: totalRuns }));
    }

    return aggregated;
}

export function aggregateRuns(runs: IPerformanceRun[]): IAutocannonResult | null {
    const results = runs
        .map((run) => run.result)
        .filter((result): result is IAutocannonRunResult => result !== null);
    if (results.length === 0) return null;

    const values = targetRunValues(runs).filter((value): value is number => value !== null);
    const first = results[0];
    const errorRate = mean(results.map((result) => result.errorRate));

    return {
        score: values.length > 0 ? round(mean(values), 2) : null,
        targetLatency: first.targetLatency,
        satisfied: sum(results.map((result) => result.satisfied)),
        tolerating: sum(results.map((result) => result.tolerating)),
        frustrated: sum(results.map((result) => result.frustrated)),
        sampleSize: sum(results.map((result) => result.sampleSize)),
        excluded4xx: sum(results.map((result) => result.excluded4xx)),
        serverErrors: sum(results.map((result) => result.serverErrors)),
        unanswered: sum(results.map((result) => result.unanswered)),
        errorRate: round(errorRate, 4),
        latency: aggregateLatency(results),
        requestsPerSecond: round(mean(results.map((result) => result.requestsPerSecond)), 2),
        statusCodes: sumStatusCodes(results),
        series: first.series,
        totalRequests: sum(results.map((result) => result.totalRequests)),
        errors: sum(results.map((result) => result.errors)),
        timeouts: sum(results.map((result) => result.timeouts)),
        firstFailure: results.find((result) => result.firstFailure)?.firstFailure ?? null,
        warnings: aggregateWarnings(results, runs.length, values.length),
        runCount: runs.length,
        runsCounted: values.length,
        dispersion: summarizeDispersion(values),
        runs,
    };
}
