import autocannon from 'autocannon';
import {
    IAutocannonResult,
    ILatencySummary,
    ILoadTestOptions,
    IPerformanceSeriesPoint,
} from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { isMutatingMethod } from '../utils/httpMethodUtils.js';
import { DEFAULT_TARGET_LATENCY_MS, FRUSTRATED_LATENCY_MULTIPLIER, defaultDurationFor } from '../utils/loadTestLimits.js';
import { round } from '../utils/round.js';
import { auditMessage, IAuditMessage } from '../messages/catalog.js';

const MIN_SAMPLE_SIZE = 100;
const MIN_RESPONSE_TIMEOUT_SECONDS = 10;
const P95_MIN_SAMPLE_SIZE = 20;
const P99_MIN_SAMPLE_SIZE = 100;
const P99_9_MIN_SAMPLE_SIZE = 1000;
const MIN_TICK_INTERVAL_MS = 500;

interface SecondCounts {
    responses: number;
    measured: number;
    latencySum: number;
    errors: number;
}

interface ResponseCounts {
    satisfied: number;
    tolerating: number;
    frustrated: number;
    excluded4xx: number;
    serverErrors: number;
    responses: number;
    unanswered: number;
    measured: number;
    latencySum: number;
    latencyHistogram: Uint32Array;
    currentSecond: SecondCounts;
    seconds: SecondCounts[];
}

interface LoadTestRun {
    result: autocannon.Result;
    counts: ResponseCounts;
    elapsedMs: number;
}

export class AutocannonService {
    public async runLoadTest(targetUrl: string, options: ILoadTestOptions): Promise<IAutocannonResult> {
        const { method } = options;
        const isMutating = isMutatingMethod(method);

        if (isMutating && !options.allowMutatingMethods) {
            throw new AppError('LOAD_TEST_MUTATING_NOT_ALLOWED', { method });
        }

        const duration = options.duration ?? defaultDurationFor(method);
        const targetLatency = options.targetLatency ?? DEFAULT_TARGET_LATENCY_MS;
        const runOptions = this.buildRunOptions(targetUrl, options, duration, targetLatency);

        const run = await this.run(runOptions, duration, targetLatency);

        return this.summarize(run, targetLatency, this.buildWarnings(options));
    }

    private buildWarnings(options: ILoadTestOptions): IAuditMessage[] {
        const { method, body, payloadFactory } = options;
        const warnings: IAuditMessage[] = [];

        if (isMutatingMethod(method)) {
            warnings.push(auditMessage('PERF_MUTATING_METHOD', { method }));
            if (method === 'PUT' || method === 'PATCH') {
                warnings.push(auditMessage('PERF_SYNTHETIC_PATH_IDS'));
            }
            if (payloadFactory) {
                warnings.push(auditMessage('PERF_SYNTHETIC_UNIQUE_FIELDS'));
            }
            if (method !== 'DELETE' && !body && !payloadFactory) {
                warnings.push(auditMessage('PERF_MISSING_BODY'));
            }
        }

        if (options.allowHighLoad) {
            warnings.push(auditMessage('PERF_HIGH_LOAD'));
        }

        return warnings;
    }

    private buildRunOptions(
        targetUrl: string,
        options: ILoadTestOptions,
        duration: number,
        targetLatency: number,
    ): autocannon.Options {
        const { method, requestsPerSecond, body, payloadFactory } = options;
        const isMutating = isMutatingMethod(method);
        const maxRequests = options.maxRequests ?? (isMutating ? 50 : undefined);
        const connections = Math.min(options.connections ?? (isMutating ? 2 : 10), maxRequests ?? Infinity);

        const headers: Record<string, string> = { ...options.headers };
        if ((body || payloadFactory) && !headers['content-type'] && !headers['Content-Type']) {
            headers['content-type'] = 'application/json';
        }

        const limits = {
            duration,
            connections,
            timeout: this.responseTimeoutSeconds(targetLatency),
            ...(maxRequests && { amount: maxRequests }),
            ...(requestsPerSecond && { overallRate: requestsPerSecond }),
        };

        if (!payloadFactory) {
            return { ...limits, url: targetUrl, method, headers, ...(body && { body }) };
        }

        const parsedUrl = new URL(targetUrl);

        return {
            ...limits,
            url: `${parsedUrl.protocol}//${parsedUrl.host}`,
            requests: [
                {
                    method,
                    path: `${parsedUrl.pathname || '/'}${parsedUrl.search}`,
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
    }

    private responseTimeoutSeconds(targetLatency: number): number {
        return Math.max(
            MIN_RESPONSE_TIMEOUT_SECONDS,
            Math.ceil((FRUSTRATED_LATENCY_MULTIPLIER * targetLatency) / 1000),
        );
    }

    private summarize(
        { result, counts, elapsedMs }: LoadTestRun,
        targetLatency: number,
        warnings: IAuditMessage[],
    ): IAutocannonResult {
        const errors = result.errors ?? 0;
        const satisfied = counts.satisfied;
        const tolerating = counts.tolerating;
        const frustrated = counts.frustrated + errors + counts.unanswered;
        const sampleSize = satisfied + tolerating + frustrated;
        const totalAttempts = counts.responses + errors + counts.unanswered;

        if (counts.excluded4xx > 0) {
            warnings.push(auditMessage('PERF_EXCLUDED_4XX', { count: counts.excluded4xx }));
        }
        if (counts.responses === 0 && totalAttempts > 0) {
            warnings.push(auditMessage('PERF_NO_RESPONSE', { attempts: totalAttempts }));
        }
        if (sampleSize === 0) {
            warnings.push(auditMessage('PERF_NO_VALID_SAMPLE'));
        } else if (sampleSize < MIN_SAMPLE_SIZE) {
            warnings.push(auditMessage('PERF_SMALL_SAMPLE', { sampleSize }));
        }

        const score = sampleSize === 0
            ? null
            : Math.round(((satisfied + tolerating / 2) / sampleSize) * 10000) / 100;

        return {
            score,
            targetLatency,
            satisfied,
            tolerating,
            frustrated,
            sampleSize,
            excluded4xx: counts.excluded4xx,
            serverErrors: counts.serverErrors,
            unanswered: counts.unanswered,
            errorRate: totalAttempts === 0
                ? 0
                : round((counts.serverErrors + errors + counts.unanswered) / totalAttempts, 4),
            latency: this.summarizeLatency(counts),
            requestsPerSecond: elapsedMs > 0 ? round(counts.responses / (elapsedMs / 1000), 2) : 0,
            statusCodes: Object.fromEntries(
                Object.entries(result.statusCodeStats ?? {}).map(([code, stats]) => [code, stats.count ?? 0]),
            ),
            series: counts.seconds.map((second, index) => this.summarizeSecond(second, index + 1)),
            totalRequests: result.requests?.sent ?? 0,
            errors,
            timeouts: result.timeouts ?? 0,
            warnings,
        };
    }

    private summarizeLatency(counts: ResponseCounts): ILatencySummary | null {
        const { measured, latencyHistogram } = counts;
        if (measured === 0) return null;

        const percentile = (perMille: number): number =>
            this.latencyAtRank(latencyHistogram, Math.ceil((measured * perMille) / 1000));

        return {
            min: this.latencyAtRank(latencyHistogram, 1),
            mean: round(counts.latencySum / measured, 2),
            p50: percentile(500),
            p95: measured >= P95_MIN_SAMPLE_SIZE ? percentile(950) : null,
            p99: measured >= P99_MIN_SAMPLE_SIZE ? percentile(990) : null,
            p99_9: measured >= P99_9_MIN_SAMPLE_SIZE ? percentile(999) : null,
            max: this.latencyAtRank(latencyHistogram, measured),
        };
    }

    private latencyAtRank(histogram: Uint32Array, rank: number): number {
        let cumulative = 0;

        for (let ms = 0; ms < histogram.length; ms++) {
            cumulative += histogram[ms];
            if (cumulative >= rank) return ms;
        }

        return histogram.length - 1;
    }

    private summarizeSecond(counts: SecondCounts, second: number): IPerformanceSeriesPoint {
        return {
            second,
            responses: counts.responses,
            meanLatency: counts.measured === 0 ? null : round(counts.latencySum / counts.measured, 2),
            errors: counts.errors,
        };
    }

    private emptySecond(): SecondCounts {
        return { responses: 0, measured: 0, latencySum: 0, errors: 0 };
    }

    private run(
        options: autocannon.Options,
        durationSeconds: number,
        targetLatency: number,
    ): Promise<LoadTestRun> {
        return new Promise((resolve, reject) => {
            let stopTimer: NodeJS.Timeout | undefined;
            let lastClientDoneAt: number | undefined;
            const counts: ResponseCounts = {
                satisfied: 0,
                tolerating: 0,
                frustrated: 0,
                excluded4xx: 0,
                serverErrors: 0,
                responses: 0,
                unanswered: 0,
                measured: 0,
                latencySum: 0,
                latencyHistogram: new Uint32Array(this.responseTimeoutSeconds(targetLatency) * 1000 + 1),
                currentSecond: this.emptySecond(),
                seconds: [],
            };
            const sentAtByClient = new Map<autocannon.Client, number>();
            const setupClient = (client: autocannon.Client) => {
                const emitter: NodeJS.EventEmitter = client;
                emitter.on('request', () => sentAtByClient.set(client, Date.now()));
                for (const event of ['response', 'timeout', 'connError']) {
                    emitter.on(event, () => sentAtByClient.delete(client));
                }
                emitter.on('done', () => {
                    lastClientDoneAt = performance.now();
                });
            };
            const startedAt = performance.now();
            let lastTickAt = startedAt;
            const instance = autocannon({ ...options, setupClient }, (err, res) => {
                clearTimeout(stopTimer);
                if (err) {
                    return reject(err);
                }
                const finishedAt = Date.now();
                for (const sentAt of sentAtByClient.values()) {
                    if (finishedAt - sentAt > FRUSTRATED_LATENCY_MULTIPLIER * targetLatency) {
                        counts.unanswered++;
                    }
                }
                if (counts.currentSecond.responses + counts.currentSecond.errors > 0) {
                    counts.seconds.push(counts.currentSecond);
                }
                resolve({ result: res, counts, elapsedMs: (lastClientDoneAt ?? performance.now()) - startedAt });
            });
            instance.on('response', (_client, statusCode, _resBytes, responseTime) => {
                this.classifyResponse(counts, statusCode, responseTime, targetLatency);
            });
            instance.on('reqError', () => {
                counts.currentSecond.errors++;
            });
            instance.on('tick', () => {
                const now = performance.now();
                if (now - lastTickAt < MIN_TICK_INTERVAL_MS) return;
                lastTickAt = now;
                counts.seconds.push(counts.currentSecond);
                counts.currentSecond = this.emptySecond();
            });
            if (options.amount) {
                stopTimer = setTimeout(() => instance.stop(), durationSeconds * 1000);
            }
        });
    }

    private classifyResponse(counts: ResponseCounts, statusCode: number, responseTime: number, T: number): void {
        if (statusCode < 200) return;
        const second = counts.currentSecond;
        counts.responses++;
        second.responses++;

        if (statusCode >= 400 && statusCode < 500) {
            counts.excluded4xx++;
            return;
        }

        const slot = Math.min(Math.round(responseTime), counts.latencyHistogram.length - 1);
        counts.measured++;
        counts.latencySum += responseTime;
        counts.latencyHistogram[slot]++;
        second.measured++;
        second.latencySum += responseTime;

        if (statusCode >= 500) {
            second.errors++;
            counts.serverErrors++;
            counts.frustrated++;
        } else if (responseTime <= T) {
            counts.satisfied++;
        } else if (responseTime <= FRUSTRATED_LATENCY_MULTIPLIER * T) {
            counts.tolerating++;
        } else {
            counts.frustrated++;
        }
    }
}
