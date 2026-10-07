import { AutocannonService, DEFAULT_TARGET_LATENCY_MS } from '../services/AutocannonService.js';
import { resolveTargetUrl, prepareLoadTestOptions } from '../utils/resolveTargetUrl.js';
import { withMeasurementLock } from '../utils/measurementLock.js';
import type { IPerformanceTargetResult } from '../interfaces/evaluation.interface.js';
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

        for (const target of targets) {
            const effectiveMethod = (
                target.method ||
                loadTestOptions?.method ||
                'GET'
            ).toUpperCase();

            try {
                const targetUrl = resolveTargetUrl(spec, baseUrl, target.path, effectiveMethod);

                const loadTestOpts = prepareLoadTestOptions({
                    targetMethod: effectiveMethod,
                    payload: target.payload,
                    loadTestOptions,
                    spec,
                    targetPath: target.path,
                });

                const result = await withMeasurementLock(() => autocannonService.runLoadTest(targetUrl, loadTestOpts));

                performanceResults.push({
                    path: target.path,
                    method: effectiveMethod,
                    result,
                });
            } catch (err: any) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                performanceResults.push({
                    path: target.path,
                    method: effectiveMethod,
                    result: null,
                    error: errorMessage,
                });
            }
        }

        const hasMeasured = performanceResults.some((r) => r.result?.score != null);
        if (performanceResults.length > 0 && !hasMeasured) {
            const errorDetails = performanceResults
                .map((r) => `${r.method} ${r.path}: ${r.error || 'Not measured (no valid sample)'}`)
                .join('; ');
            throw new PillarError(`No performance target was measured: ${errorDetails}`, { performanceResults });
        }

        const counted = performanceResults.filter((r) => r.result === null || r.result.score != null);
        const totalScore = counted.reduce((sum, r) => sum + (r.result?.score ?? 0), 0);
        const score = counted.length > 0
            ? Math.round((totalScore / counted.length) * 100) / 100
            : 0;

        return {
            score,
            result: performanceResults,
            scoring: {
                performance: {
                    targetLatency: loadTestOptions?.targetLatency ?? DEFAULT_TARGET_LATENCY_MS,
                },
            },
        };
    },
};
