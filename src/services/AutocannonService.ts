import autocannon from 'autocannon';
import { IAutocannonResult, ILoadTestOptions } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { isMutatingMethod } from '../utils/httpMethodUtils.js';
import { DEFAULT_TARGET_LATENCY_MS, FRUSTRATED_LATENCY_MULTIPLIER, defaultDurationFor } from '../utils/loadTestLimits.js';
import { auditMessage, IAuditMessage } from '../messages/catalog.js';

const MIN_SAMPLE_SIZE = 100;

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
}

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

        const duration = options.duration ?? defaultDurationFor(method);
        const maxRequests = options.maxRequests ?? (isMutating ? 50 : undefined);
        const connections = Math.min(options.connections ?? (isMutating ? 2 : 10), maxRequests ?? Infinity);
        const { targetLatency = DEFAULT_TARGET_LATENCY_MS, requestsPerSecond, body, payloadFactory } = options;

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

        const { result, counts } = await this.run(runOptions, duration, targetLatency);

        const errors = result.errors ?? 0;
        const satisfied = counts.satisfied;
        const tolerating = counts.tolerating;
        const frustrated = counts.frustrated + errors + counts.unanswered;
        const sampleSize = satisfied + tolerating + frustrated;
        const totalAttempts = counts.responses + errors + counts.unanswered;

        if (counts.excluded4xx > 0) {
            warnings.push(auditMessage('PERF_EXCLUDED_4XX', { count: counts.excluded4xx }));
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
                : Math.round(((counts.serverErrors + errors + counts.unanswered) / totalAttempts) * 10000) / 10000,
            averageLatency: counts.measured === 0
                ? 0
                : Math.round((counts.latencySum / counts.measured) * 100) / 100,
            totalRequests: result.requests?.sent ?? 0,
            errors,
            timeouts: result.timeouts ?? 0,
            warnings,
        };
    }

    private run(
        options: autocannon.Options,
        durationSeconds: number,
        targetLatency: number,
    ): Promise<{ result: autocannon.Result; counts: ResponseCounts }> {
        return new Promise((resolve, reject) => {
            let stopTimer: NodeJS.Timeout | undefined;
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
            };
            const sentAtByClient = new Map<autocannon.Client, number>();
            const setupClient = (client: autocannon.Client) => {
                const emitter: NodeJS.EventEmitter = client;
                emitter.on('request', () => sentAtByClient.set(client, Date.now()));
                for (const event of ['response', 'timeout', 'connError']) {
                    emitter.on(event, () => sentAtByClient.delete(client));
                }
            };
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
                resolve({ result: res, counts });
            });
            instance.on('response', (_client, statusCode, _resBytes, responseTime) => {
                this.classifyResponse(counts, statusCode, responseTime, targetLatency);
            });
            if (options.amount) {
                stopTimer = setTimeout(() => instance.stop(), durationSeconds * 1000);
            }
        });
    }

    private classifyResponse(counts: ResponseCounts, statusCode: number, responseTime: number, T: number): void {
        if (statusCode < 200) return;
        counts.responses++;

        if (statusCode >= 400 && statusCode < 500) {
            counts.excluded4xx++;
            return;
        }

        counts.measured++;
        counts.latencySum += responseTime;

        if (statusCode >= 500) {
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
