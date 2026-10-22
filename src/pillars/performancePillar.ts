import os from 'node:os';
import { processRole } from '../config/processRole.js';
import { AppError } from '../errors/AppError.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { DEFAULT_TARGET_LATENCY_MS, defaultDurationFor } from '../utils/loadTestLimits.js';
import { resolveTargetUrl, prepareLoadTestOptions } from '../utils/resolveTargetUrl.js';
import { withMeasurementLock } from '../utils/measurementLock.js';
import { withLoadTestAdvisoryLock } from '../utils/advisoryLock.js';
import { loadGate } from '../utils/loadGate.js';
import { resolveMeasurementPlan } from '../utils/measurementPlan.js';
import { assessStability, aggregateRuns, pillarRunScores, targetRunValues } from '../utils/aggregateRuns.js';
import { detectSharedMachine } from '../utils/sameMachine.js';
import type { SharedMachineCheck } from '../utils/sameMachine.js';
import { round } from '../utils/round.js';
import { scorePart } from '../utils/scorePart.js';
import { auditMessage } from '../messages/catalog.js';
import type { IAuditMessage } from '../messages/catalog.js';
import type {
    ILoadTestOptions,
    IPerformanceRun,
    IPerformanceTargetResult,
    IStepProgress,
} from '../interfaces/evaluation.interface.js';
import type { PerformanceRequestInput } from '../schemas/evaluation.schema.js';
import { PillarError } from './PillarError.js';
import type { Pillar } from './types.js';

type PreparedTarget =
    | { path: string; method: string; url: string; options: ILoadTestOptions; failure?: undefined }
    | { path: string; method: string; failure: AppError };

function hostnameOf(baseUrl: string): string | null {
    try {
        return new URL(baseUrl).hostname;
    } catch {
        return null;
    }
}

function sleep(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

const autocannonService = new AutocannonService();

export const performancePillar: Pillar<PerformanceRequestInput, 'performanceResults'> = {
    name: 'performance',
    column: 'performanceResults',
    run: async (ctx) => {
        const { targets, loadTestOptions } = ctx.params;
        const plan = resolveMeasurementPlan(loadTestOptions);
        const spec = (await ctx.spec()).data;
        const baseUrl = await ctx.apiBaseUrl();
        const apiHost = hostnameOf(baseUrl);
        const sharedMachine: SharedMachineCheck = apiHost === null
            ? { status: 'unverified', cause: 'unresolved' }
            : await detectSharedMachine(apiHost);

        const prepared: PreparedTarget[] = targets.map((target) => {
            const method = target.method ?? loadTestOptions?.method ?? 'GET';
            try {
                return {
                    path: target.path,
                    method,
                    url: resolveTargetUrl(spec, baseUrl, target.path, method, target.pathParams),
                    options: prepareLoadTestOptions({
                        method,
                        payload: target.payload,
                        loadTestOptions,
                        spec,
                        targetPath: target.path,
                    }),
                };
            } catch (err: unknown) {
                return { path: target.path, method, failure: AppError.from(err, 'LOAD_TEST_FAILED') };
            }
        });

        const runsByTarget: IPerformanceRun[][] = prepared.map(() => []);

        const buildResults = (): IPerformanceTargetResult[] => {
            const results: IPerformanceTargetResult[] = [];
            for (const [index, target] of prepared.entries()) {
                if (target.failure) {
                    results.push({ path: target.path, method: target.method, result: null, error: target.failure.message, code: target.failure.code });
                    continue;
                }
                const runs = runsByTarget[index];
                if (runs.length === 0) break;
                const result = aggregateRuns(runs);
                if (result) {
                    results.push({ path: target.path, method: target.method, result });
                    continue;
                }
                const failed = runs.find((run) => run.error !== undefined);
                results.push({ path: target.path, method: target.method, result: null, error: failed?.error, code: failed?.code });
            }
            return results;
        };

        const progressFor = (
            targetIndex: number,
            run: number,
            phase: IStepProgress['phase'],
            expectedDurationSeconds: number,
        ): IStepProgress => ({
            targetIndex,
            totalTargets: targets.length,
            run,
            totalRuns: plan.repetitions,
            phase,
            startedAt: phase === 'QUEUED' ? null : new Date().toISOString(),
            expectedDurationSeconds,
            elapsedSeconds: 0,
            responses: 0,
            errors: 0,
            lastSecond: null,
        });

        const firstRunnable = prepared.findIndex((target) => !target.failure);
        if (firstRunnable >= 0) {
            const first = prepared[firstRunnable];
            if (!first.failure) {
                ctx.report({
                    progress: progressFor(firstRunnable, 1, 'QUEUED', first.options.duration ?? defaultDurationFor(first.method)),
                });
            }
        }

        await loadGate.runLoad(() => withMeasurementLock(() => withLoadTestAdvisoryLock(async () => {
            for (let run = 1; run <= plan.repetitions; run++) {
                if (run > 1 && plan.restIntervalSeconds > 0) {
                    ctx.report({ progress: progressFor(0, run, 'RESTING', plan.restIntervalSeconds) });
                    await sleep(plan.restIntervalSeconds);
                }

                for (const [targetIndex, target] of prepared.entries()) {
                    if (target.failure) continue;

                    const running = progressFor(targetIndex, run, 'RUNNING', target.options.duration ?? defaultDurationFor(target.method));
                    ctx.report({ progress: running });

                    try {
                        const result = await autocannonService.runLoadTest(
                            target.url,
                            target.options,
                            (tick) => ctx.report({ progress: { ...running, ...tick } }),
                        );
                        runsByTarget[targetIndex].push({ run, result });
                    } catch (err: unknown) {
                        const failure = AppError.from(err, 'LOAD_TEST_FAILED');
                        runsByTarget[targetIndex].push({ run, result: null, error: failure.message, code: failure.code });
                    }

                    ctx.report({ result: buildResults() });
                }
            }
        })));

        const performanceResults = buildResults();

        const hasMeasured = performanceResults.some((r) => r.result?.score != null);
        if (performanceResults.length > 0 && !hasMeasured) {
            const details = performanceResults
                .map((r) => `${r.method} ${r.path}: ${r.error || 'sem amostra válida.'}`)
                .join(' ');
            throw new PillarError({ performanceResults }, 'PERFORMANCE_NO_TARGET_MEASURED', { details });
        }

        const counted = performanceResults
            .map((r, index) => ({ index, counts: r.result === null || r.result.score != null, score: r.result?.score ?? 0 }))
            .filter((target) => target.counts);
        const totalScore = counted.reduce((sum, target) => sum + target.score, 0);
        const score = counted.length > 0
            ? round(totalScore / counted.length, 2)
            : 0;

        const valuesByTarget = prepared.map((target, index) => target.failure
            ? Array<number | null>(plan.repetitions).fill(0)
            : targetRunValues(runsByTarget[index]));
        const runScores = pillarRunScores(valuesByTarget, plan.repetitions);
        const stability = assessStability(runScores, plan.stabilityThreshold);

        const warnings: IAuditMessage[] = [];
        if (stability.status === 'low' && stability.coefficientOfVariation !== null) {
            warnings.push(auditMessage('PERF_LOW_STABILITY', {
                coefficientOfVariation: stability.coefficientOfVariation,
                threshold: plan.stabilityThreshold,
                runs: stability.runsCounted,
            }));
        } else if (stability.status === 'not_measured') {
            warnings.push(auditMessage('PERF_STABILITY_NOT_MEASURED'));
        }
        if (sharedMachine.status === 'shared') {
            warnings.push(auditMessage('PERF_SAME_MACHINE', { host: apiHost ?? baseUrl }));
        } else if (sharedMachine.status === 'unverified' && sharedMachine.cause === 'container-network') {
            warnings.push(auditMessage('PERF_SAME_MACHINE_CONTAINER_UNVERIFIED', { host: apiHost ?? baseUrl, address: sharedMachine.address }));
        } else if (sharedMachine.status === 'unverified') {
            warnings.push(auditMessage('PERF_SAME_MACHINE_UNVERIFIED', { host: apiHost ?? baseUrl }));
        }

        return {
            score,
            breakdown: counted.map((target) => scorePart(String(target.index), 1 / counted.length, target.score)),
            result: performanceResults,
            scoring: {
                performance: {
                    targetLatency: loadTestOptions?.targetLatency ?? DEFAULT_TARGET_LATENCY_MS,
                    mode: plan.mode,
                    repetitions: plan.repetitions,
                    restIntervalSeconds: plan.restIntervalSeconds,
                    thresholds: {
                        status: 'provisional',
                        maxCpuUsage: plan.maxCpuUsage,
                        maxEventLoopDelayMs: plan.maxEventLoopDelayMs,
                        stabilityThreshold: plan.stabilityThreshold,
                    },
                    execution: {
                        host: os.hostname(),
                        pid: process.pid,
                        workerMode: processRole() === 'load-worker' ? 'external' : 'embedded',
                        apiHost: apiHost ?? baseUrl,
                        sameMachine: sharedMachine.status,
                    },
                    runScores,
                    stability,
                    warnings,
                },
            },
        };
    },
};
