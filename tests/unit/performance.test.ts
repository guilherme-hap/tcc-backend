import { describe, expect, it } from 'vitest';
import type { IAutocannonRunResult, IPerformanceRun } from '../../src/interfaces/evaluation.interface.js';
import { AutocannonService } from '../../src/services/AutocannonService.js';
import { aggregateRuns, assessStability, pillarRunScores, runApdex, summarizeDispersion } from '../../src/utils/aggregateRuns.js';
import { createLatencySamples, mergeLatencySamples, recordLatency, summarizeLatency } from '../../src/utils/latencySamples.js';
import { apdexWindowIssue, defaultDurationFor } from '../../src/utils/loadTestLimits.js';
import { evaluateSaturation } from '../../src/utils/saturation.js';

type Summarize = (
    run: unknown,
    targetLatency: number,
    warnings: { code: string }[],
    plan: { maxCpuUsage: number; maxEventLoopDelayMs: number },
    firstFailure: null,
) => IAutocannonRunResult;

const summarize = (counts: Record<string, number>, errors = 0): IAutocannonRunResult => {
    const service = new AutocannonService() as unknown as { summarize: Summarize };
    return service.summarize({
        result: { errors, timeouts: 0, statusCodeStats: { 200: { count: counts.responses ?? 0 } } },
        counts: {
            satisfied: 0, tolerating: 0, frustrated: 0, unanswered: 0, excluded4xx: 0, rejectedAuth: 0,
            responses: 0, serverErrors: 0, inFlightAtEnd: 0, sent: 0, latency: null, seconds: [],
            ...counts,
        },
        elapsedMs: 10_000,
        saturation: { cpuUsage: 0.2, eventLoopDelayP99Ms: 1, exceeded: false },
    }, 1000, [], { maxCpuUsage: 0.8, maxEventLoopDelayMs: 50 }, null);
};

describe('Apdex', () => {
    it('conta tolerante como meio e frustrado como zero', () => {
        expect(summarize({ satisfied: 70, tolerating: 20, frustrated: 10, responses: 100 }).score).toBe(80);
    });

    it('conta erros de conexão e requisições sem resposta como frustrados', () => {
        const result = summarize({ satisfied: 80, tolerating: 10, frustrated: 5, unanswered: 2, responses: 95 }, 3);

        expect(result.frustrated).toBe(10);
        expect(result.sampleSize).toBe(100);
        expect(result.score).toBe(85);
    });

    it('deixa respostas 4xx fora da amostra e avisa', () => {
        const result = summarize({ satisfied: 10, excluded4xx: 90, responses: 100 });

        expect(result.score).toBe(100);
        expect(result.sampleSize).toBe(10);
        expect(result.warnings.map((warning) => warning.code)).toContain('PERF_EXCLUDED_4XX');
    });

    it('fica sem nota quando nenhuma amostra é válida', () => {
        const result = summarize({ excluded4xx: 5, responses: 5 });

        expect(result.score).toBeNull();
        expect(result.warnings.map((warning) => warning.code)).toContain('PERF_NO_VALID_SAMPLE');
    });

    it('calcula taxa de erro e vazão', () => {
        const result = summarize({ satisfied: 90, serverErrors: 10, frustrated: 10, responses: 100 });

        expect(result.errorRate).toBe(0.1);
        expect(result.requestsPerSecond).toBe(10);
    });

    it('exige duração maior que quatro vezes o tempo-alvo', () => {
        expect(apdexWindowIssue(4, 1000)).not.toBeNull();
        expect(apdexWindowIssue(4.1, 1000)).toBeNull();
    });

    it('usa duração menor para métodos que alteram dados', () => {
        expect(defaultDurationFor('GET')).toBe(10);
        expect(defaultDurationFor('POST')).toBe(5);
    });
});

describe('agregação das execuções', () => {
    const run = (score: number | null) => ({ result: score === null ? null : { score } }) as IPerformanceRun;

    it('trata execução sem resultado como 0 e sem amostra como não contada', () => {
        expect(runApdex(run(null))).toBe(0);
        expect(runApdex(run(80))).toBe(80);
        expect(runApdex({ result: { score: null } } as IPerformanceRun)).toBeNull();
    });

    it('calcula a nota de cada execução pela média dos alvos', () => {
        expect(pillarRunScores([[100, 80], [50, null]], 2)).toEqual([75, 80]);
        expect(pillarRunScores([[null]], 1)).toEqual([null]);
    });

    it('classifica a estabilidade pelo coeficiente de variação', () => {
        expect(assessStability([90, 90, 90], 0.1)).toMatchObject({ status: 'stable', coefficientOfVariation: 0, runsCounted: 3 });
        expect(assessStability([100, 50, 75], 0.1)).toMatchObject({ status: 'low', coefficientOfVariation: 0.3333 });
        expect(assessStability([90, null], 0.1)).toMatchObject({ status: 'not_measured', runsCounted: 1 });
    });

    it('resume a dispersão com desvio amostral', () => {
        expect(summarizeDispersion([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({ stddev: 2.14, min: 2, max: 9 });
        expect(summarizeDispersion([1])).toBeNull();
    });

    it('agrega contagens e média de execuções', () => {
        const first = summarize({ satisfied: 100, responses: 100, sent: 100 });
        const second = summarize({ satisfied: 50, frustrated: 50, responses: 100, sent: 100 });
        const aggregated = aggregateRuns([{ result: first }, { result: second }] as IPerformanceRun[], null);

        expect(aggregated?.score).toBe(75);
        expect(aggregated?.satisfied).toBe(150);
        expect(aggregated?.totalRequests).toBe(200);
        expect(aggregated?.runsCounted).toBe(2);
    });

    it('não produz resultado quando nenhuma execução terminou', () => {
        expect(aggregateRuns([run(null)], null)).toBeNull();
    });
});

describe('amostras de latência', () => {
    it('calcula os percentis pelo histograma', () => {
        const samples = createLatencySamples(1000);
        for (let ms = 1; ms <= 100; ms++) recordLatency(samples, ms);

        expect(summarizeLatency(samples)).toMatchObject({ min: 1, mean: 50.5, p50: 50, p95: 95, p99: 99, p99_9: null, max: 100 });
    });

    it('omite percentis sem amostra suficiente', () => {
        const samples = createLatencySamples(100);
        recordLatency(samples, 10);

        expect(summarizeLatency(samples)).toMatchObject({ p95: null, p99: null });
        expect(summarizeLatency(createLatencySamples(10))).toBeNull();
    });

    it('limita ao maior valor do histograma e combina amostras', () => {
        const a = createLatencySamples(10);
        const b = createLatencySamples(20);
        recordLatency(a, 50);
        recordLatency(b, 15);
        const merged = mergeLatencySamples(a, b);

        expect(merged.count).toBe(2);
        expect(summarizeLatency(merged)).toMatchObject({ min: 10, max: 15 });
    });
});

describe('saturação do gerador', () => {
    const thresholds = { maxCpuUsage: 0.8, maxEventLoopDelayMs: 50 };

    it('marca quando CPU ou laço de eventos passam do limite', () => {
        expect(evaluateSaturation(0.8, 50, thresholds).exceeded).toBe(false);
        expect(evaluateSaturation(0.81, 1, thresholds).exceeded).toBe(true);
        expect(evaluateSaturation(0.1, 51, thresholds).exceeded).toBe(true);
    });
});
