import { AppError } from '../errors/AppError.js';
import { AutocannonService } from '../services/AutocannonService.js';
import { DEFAULT_TARGET_LATENCY_MS, defaultDurationFor } from '../utils/loadTestLimits.js';
import { resolveTargetUrl, prepareLoadTestOptions } from '../utils/resolveTargetUrl.js';
import { withMeasurementLock } from '../utils/measurementLock.js';
import { round } from '../utils/round.js';
import { scorePart } from '../utils/scorePart.js';
import type { IPerformanceTargetResult, IStepProgress } from '../interfaces/evaluation.interface.js';
import type { PerformanceRequestInput } from '../schemas/evaluation.schema.js';
import { PillarError } from './PillarError.js';
import type { Pillar } from './types.js';

const autocannonService = new AutocannonService();

export const performancePillar: Pillar<PerformanceRequestInput, 'performanceResults'> = {
    name: 'performance',
    column: 'performanceResults',
    run: async (ctx) => {
        const { targets, loadTestOptions } = ctx.params;
        const spec = (await ctx.spec()).data;
        const baseUrl = await ctx.apiBaseUrl();

        const performanceResults: IPerformanceTargetResult[] = [];

        for (const [targetIndex, target] of targets.entries()) {
            const method = target.method ?? loadTestOptions?.method ?? 'GET';

            try {
                const targetUrl = resolveTargetUrl(spec, baseUrl, target.path, method, target.pathParams);

                const loadTestOpts = prepareLoadTestOptions({
                    method,
                    payload: target.payload,
                    loadTestOptions,
                    spec,
                    targetPath: target.path,
                });

                const queued: IStepProgress = {
                    targetIndex,
                    totalTargets: targets.length,
                    phase: 'QUEUED',
                    startedAt: null,
                    expectedDurationSeconds: loadTestOpts.duration ?? defaultDurationFor(method),
                    elapsedSeconds: 0,
                    responses: 0,
                    errors: 0,
                    lastSecond: null,
                };
                ctx.report({ progress: queued });

                const result = await withMeasurementLock(() => {
                    const running: IStepProgress = { ...queued, phase: 'RUNNING', startedAt: new Date().toISOString() };
                    ctx.report({ progress: running });
                    return autocannonService.runLoadTest(
                        targetUrl,
                        loadTestOpts,
                        (tick) => ctx.report({ progress: { ...running, ...tick } }),
                    );
                });

                performanceResults.push({
                    path: target.path,
                    method,
                    result,
                });
            } catch (err: unknown) {
                const failure = AppError.from(err, 'LOAD_TEST_FAILED');
                performanceResults.push({
                    path: target.path,
                    method,
                    result: null,
                    error: failure.message,
                    code: failure.code,
                });
            }

            ctx.report({ result: [...performanceResults] });
        }

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

        return {
            score,
            breakdown: counted.map((target) => scorePart(String(target.index), 1 / counted.length, target.score)),
            result: performanceResults,
            scoring: {
                performance: {
                    targetLatency: loadTestOptions?.targetLatency ?? DEFAULT_TARGET_LATENCY_MS,
                },
            },
        };
    },
};
