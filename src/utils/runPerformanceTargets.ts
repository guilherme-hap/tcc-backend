import { AutocannonService } from '../services/AutocannonService.js';
import { fetchOpenApiSpec } from './fetchOpenApiSpec.js';
import { resolveTargetUrl, prepareLoadTestOptions } from './resolveTargetUrl.js';
import {
    IPerformanceTarget,
    IPerformanceTargetResult,
    ILoadTestOptions,
} from '../interfaces/evaluation.interface.js';

export class PerformancePillarError extends Error {
    constructor(
        message: string,
        public performanceResults: IPerformanceTargetResult[],
    ) {
        super(message);
        this.name = 'PerformancePillarError';
    }
}

export interface RunPerformanceTargetsOptions {
    openApiUrl: string;
    apiBaseUrl?: string | null;
    targets: IPerformanceTarget[];
    loadTestOptions?: ILoadTestOptions;
    spec?: any;
    autocannonService?: AutocannonService;
}

export interface RunPerformanceTargetsOutput {
    score: number;
    performanceResults: IPerformanceTargetResult[];
}

export async function runPerformanceTargets(
    options: RunPerformanceTargetsOptions,
): Promise<RunPerformanceTargetsOutput> {
    const autocannonService = options.autocannonService ?? new AutocannonService();
    const spec = options.spec ?? (await fetchOpenApiSpec(options.openApiUrl));

    const performanceResults: IPerformanceTargetResult[] = [];

    for (const target of options.targets) {
        const effectiveMethod = (
            target.method ||
            options.loadTestOptions?.method ||
            'GET'
        ).toUpperCase();

        try {
            const targetUrl = resolveTargetUrl(
                spec,
                options.openApiUrl,
                target.path,
                options.apiBaseUrl,
                effectiveMethod,
            );

            const loadTestOpts = prepareLoadTestOptions({
                targetMethod: effectiveMethod,
                payload: target.payload,
                loadTestOptions: options.loadTestOptions,
                spec,
                targetPath: target.path,
            });

            const result = await autocannonService.runLoadTest(targetUrl, loadTestOpts);

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
        throw new PerformancePillarError(`No performance target was measured: ${errorDetails}`, performanceResults);
    }

    const counted = performanceResults.filter((r) => r.result === null || r.result.score != null);
    const totalScore = counted.reduce((sum, r) => sum + (r.result?.score ?? 0), 0);
    const score = counted.length > 0
        ? Math.round((totalScore / counted.length) * 100) / 100
        : 0;

    return {
        score,
        performanceResults,
    };
}
