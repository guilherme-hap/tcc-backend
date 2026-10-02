import autocannon from 'autocannon';
import { IAutocannonResult, ILoadTestOptions } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { isMutatingMethod } from '../utils/httpMethodUtils.js';
import { DEFAULT_DURATION_SECONDS } from '../utils/loadTestLimits.js';
import { auditMessage, IAuditMessage } from '../messages/catalog.js';

export class AutocannonService {
    public async runLoadTest(targetUrl: string, options: ILoadTestOptions = {}): Promise<IAutocannonResult> {
        const method = options.method?.toUpperCase();
        const isMutating = isMutatingMethod(method);

        if (isMutating && !options.allowMutatingMethods) {
            throw new AppError(
                `Load test for mutating method ${method} requires explicit opt-in ` +
                `via allowMutatingMethods=true.`,
                400,
            );
        }

        const duration = options.duration ?? (isMutating ? 5 : DEFAULT_DURATION_SECONDS);
        const maxRequests = options.maxRequests ?? (isMutating ? 50 : undefined);
        const connections = Math.min(options.connections ?? (isMutating ? 2 : 10), maxRequests ?? Infinity);
        const { targetLatency = 300, requestsPerSecond, body, payloadFactory } = options;

        const headers: Record<string, string> = { ...options.headers };
        const hasBody = !!body || !!payloadFactory;
        if (hasBody && !headers['content-type'] && !headers['Content-Type']) {
            headers['content-type'] = 'application/json';
        }

        const warnings: IAuditMessage[] = [];
        if (isMutating && method) {
            warnings.push(auditMessage('PERF_MUTATING_METHOD', { method }));
            if (method === 'PUT' || method === 'PATCH') {
                warnings.push(auditMessage('PERF_SYNTHETIC_PATH_IDS'));
            }
            if (payloadFactory) {
                warnings.push(auditMessage('PERF_SYNTHETIC_UNIQUE_FIELDS'));
            }
            if (method !== 'DELETE' && !hasBody) {
                warnings.push(auditMessage('PERF_MISSING_BODY'));
            }
        }

        if (options.allowHighLoad) {
            warnings.push(auditMessage('PERF_HIGH_LOAD'));
        }

        const limits = {
            duration,
            connections,
            ...(maxRequests && { amount: maxRequests }),
            ...(requestsPerSecond && { overallRate: requestsPerSecond }),
        };

        let runOptions: autocannon.Options;
        if (payloadFactory) {
            const parsedUrl = new URL(targetUrl);
            const basePath = parsedUrl.pathname || '/';

            runOptions = {
                ...limits,
                url: `${parsedUrl.protocol}//${parsedUrl.host}`,
                requests: [
                    {
                        method: method as NonNullable<autocannon.Request["method"]>,
                        path: `${basePath}${parsedUrl.search}`,
                        headers,
                        setupRequest: (req: autocannon.Request) => {
                            const generatedBody = payloadFactory();
                            if (generatedBody !== undefined) {
                                req.body = generatedBody;
                            }

                            return req;
                        },
                    },
                ],
            };
        } else {
            runOptions = {
                ...limits,
                url: targetUrl,
                ...(method && { method: method as NonNullable<autocannon.Request["method"]> }),
                headers,
                ...(body && { body }),
            };
        }

        const result = await this.run(runOptions, duration);

        const score = this.calculateApdex(result, targetLatency);

        return {
            score,
            averageLatency: result.latency?.average ?? 0,
            totalRequests: result.requests?.sent ?? 0,
            errors: result.errors ?? 0,
            timeouts: result.timeouts ?? 0,
            nonSuccessResponses: result.non2xx ?? 0,
            warnings,
        };
    }

    private run(options: autocannon.Options, durationSeconds: number): Promise<autocannon.Result> {
        return new Promise((resolve, reject) => {
            let stopTimer: NodeJS.Timeout | undefined;
            const instance = autocannon(options, (err, res) => {
                clearTimeout(stopTimer);
                if (err) {
                    return reject(err);
                }
                resolve(res);
            });
            if (options.amount) {
                stopTimer = setTimeout(() => instance.stop(), durationSeconds * 1000);
            }
        });
    }

    private calculateApdex(result: autocannon.Result, T: number): number {
        const totalSent = result.requests?.sent ?? 0;
        if (totalSent === 0) return 0;

        if (!result.latency || result.latency.max === undefined) {
            return 0;
        }

        const apdexScore = result.latency.max === 0
            ? 100
            : this.calculatePercentileApdex(result.latency, T);

        const connectionErrors = result.errors ?? 0;
        const nonSuccessResponses = result.non2xx ?? 0;
        const totalFailed = connectionErrors + nonSuccessResponses;
        const successRatio = Math.max(0, (totalSent - totalFailed) / totalSent);

        const finalScore = apdexScore * successRatio;

        return Math.min(100, Math.max(0, Math.round(finalScore * 100) / 100));
    }

    private calculatePercentileApdex(latency: autocannon.Histogram, T: number): number {
        const percentiles = [
            { p: 0, v: latency.min ?? 0 },
            { p: 0.001, v: latency.p0_001 ?? 0 },
            { p: 0.01, v: latency.p0_01 ?? 0 },
            { p: 0.1, v: latency.p0_1 ?? 0 },
            { p: 1, v: latency.p1 ?? 0 },
            { p: 2.5, v: latency.p2_5 ?? 0 },
            { p: 10, v: latency.p10 ?? 0 },
            { p: 25, v: latency.p25 ?? 0 },
            { p: 50, v: latency.p50 ?? 0 },
            { p: 75, v: latency.p75 ?? 0 },
            { p: 90, v: latency.p90 ?? 0 },
            { p: 97.5, v: latency.p97_5 ?? 0 },
            { p: 99, v: latency.p99 ?? 0 },
            { p: 99.9, v: latency.p99_9 ?? 0 },
            { p: 99.99, v: latency.p99_99 ?? 0 },
            { p: 99.999, v: latency.p99_999 ?? 0 },
            { p: 100, v: latency.max ?? 0 },
        ];

        const getPercentileForValue = (value: number): number => {
            if (value < percentiles[0].v) return 0;
            if (value >= percentiles[percentiles.length - 1].v) return 100;

            for (let i = 0; i < percentiles.length - 1; i++) {
                const current = percentiles[i];
                const next = percentiles[i + 1];

                if (value >= current.v && value <= next.v) {
                    if (next.v === current.v) {
                        return next.p;
                    }
                    const ratio = (value - current.v) / (next.v - current.v);
                    return current.p + ratio * (next.p - current.p);
                }
            }
            return 100;
        };

        const satisfiedPct = getPercentileForValue(T);
        const toleratingPctUpper = getPercentileForValue(4 * T);
        const toleratingPct = Math.max(0, toleratingPctUpper - satisfiedPct);

        return satisfiedPct + (toleratingPct / 2);
    }
}
