import autocannon from 'autocannon';
import { ILoadTestOptions } from '../interfaces/evaluation.interface.js';

declare module 'autocannon' {
    interface Histogram {
        totalCount?: number;
    }
}

export interface IAutocannonResult {
    score: number;
    averageLatency: number;
    totalRequests: number;
    errors: number;
    timeouts: number;
}

export class AutocannonService {
    public async runLoadTest(baseUrl: string, options: ILoadTestOptions = {}): Promise<IAutocannonResult> {
        const { duration = 10, connections = 10, targetLatency = 300, maxRequests, requestsPerSecond, method, headers, body } = options;

        const result = await new Promise<autocannon.Result>((resolve, reject) => {
            autocannon(
                {
                    url: baseUrl,
                    duration,
                    connections,
                    ...(maxRequests && { amount: maxRequests }),
                    ...(requestsPerSecond && { overallRate: requestsPerSecond }),
                    ...(method && { method }),
                    ...(headers && { headers }),
                    ...(body && { body }),
                },
                (err, res) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(res);
                }
            );
        });

        const score = this.calculateApdex(result, targetLatency);

        return {
            score,
            averageLatency: result.latency?.average ?? 0,
            totalRequests: result.requests?.sent ?? 0,
            errors: result.errors ?? 0,
            timeouts: result.timeouts ?? 0,
        };
    }

    private calculateApdex(result: autocannon.Result, T: number): number {
        const totalSent = result.requests?.sent ?? 0;
        if (totalSent === 0) return 0;

        const totalCount = result.latency?.totalCount ?? result.latency?.total ?? 0;

        if (result.latency?.max === 0) {
            const spEdge = totalCount / totalSent;
            return Math.min(100, Math.round(spEdge * 100 * 100) / 100);
        }

        if (totalCount === 0 || result.latency?.max === undefined) return 0;

        const percentiles = [
            { p: 0, v: result.latency.min ?? 0 },
            { p: 0.001, v: result.latency.p0_001 ?? 0 },
            { p: 0.01, v: result.latency.p0_01 ?? 0 },
            { p: 0.1, v: result.latency.p0_1 ?? 0 },
            { p: 1, v: result.latency.p1 ?? 0 },
            { p: 2.5, v: result.latency.p2_5 ?? 0 },
            { p: 10, v: result.latency.p10 ?? 0 },
            { p: 25, v: result.latency.p25 ?? 0 },
            { p: 50, v: result.latency.p50 ?? 0 },
            { p: 75, v: result.latency.p75 ?? 0 },
            { p: 90, v: result.latency.p90 ?? 0 },
            { p: 97.5, v: result.latency.p97_5 ?? 0 },
            { p: 99, v: result.latency.p99 ?? 0 },
            { p: 99.9, v: result.latency.p99_9 ?? 0 },
            { p: 99.99, v: result.latency.p99_99 ?? 0 },
            { p: 99.999, v: result.latency.p99_999 ?? 0 },
            { p: 100, v: result.latency.max ?? 0 },
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

        const satisfied = (satisfiedPct / 100) * totalCount;
        const tolerating = (toleratingPct / 100) * totalCount;

        const sp = (satisfied + (tolerating / 2)) / totalSent;

        return Math.min(100, Math.round(sp * 100 * 100) / 100);
    }
}
