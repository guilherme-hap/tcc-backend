import { describe, expect, it, vi } from 'vitest';
import { AppDataSource } from '../../src/config/data-source.js';
import { Evaluation } from '../../src/entities/Evaluation.js';
import { EvaluationJob } from '../../src/entities/EvaluationJob.js';
import type { EvaluationType } from '../../src/interfaces/evaluation.interface.js';
import { evaluationQueue } from '../../src/queues/EvaluationQueue.js';
import { EvaluationLifecycleService } from '../../src/services/EvaluationLifecycleService.js';

interface ClaimedJob {
    id: string;
    evaluationId: string;
    params: unknown;
    attempts: number;
}

const internals = evaluationQueue as unknown as {
    claimJob(types: EvaluationType[]): Promise<ClaimedJob | null>;
    runJob(tag: string, job: ClaimedJob, consumer: { types: EvaluationType[]; concurrency: number; handler: () => Promise<void>; onGiveUp: () => Promise<void> }): Promise<void>;
};

const lifecycle = new EvaluationLifecycleService();

const createEvaluation = (type: EvaluationType = 'contract') => AppDataSource.transaction((manager) => lifecycle.create({
    openApiUrl: 'https://api.test.local/openapi.json',
    evaluationType: type,
    steps: [],
}, manager));

const enqueue = async (type: EvaluationType = 'contract', params: Record<string, unknown> = { openApiUrl: 'x' }) => {
    const evaluation = await createEvaluation(type);
    await AppDataSource.transaction((manager) => evaluationQueue.enqueue({ evaluationId: evaluation.id, type, params } as never, manager));
    return evaluation;
};

const jobs = () => AppDataSource.getRepository(EvaluationJob);
const consumer = (handler: () => Promise<void>, onGiveUp: () => Promise<void> = async () => undefined) => ({ types: ['contract'] as EvaluationType[], concurrency: 1, handler, onGiveUp });

describe('fila de avaliações', () => {
    it('entrega o trabalho com os parâmetros e marca a tentativa', async () => {
        const evaluation = await enqueue('contract', { openApiUrl: 'https://a.test' });
        const job = await internals.claimJob(['contract']);

        expect(job?.evaluationId).toBe(evaluation.id);
        expect(job?.params).toEqual({ openApiUrl: 'https://a.test' });
        expect(job?.attempts).toBe(1);
        expect((await jobs().findOneByOrFail({ id: job!.id })).status).toBe('RUNNING');
    });

    it('filtra pelo tipo consumido', async () => {
        await enqueue('security');

        expect(await internals.claimJob(['contract'])).toBeNull();
        expect(await internals.claimJob(['security', 'full'])).not.toBeNull();
    });

    it('não entrega o mesmo trabalho a dois consumidores simultâneos', async () => {
        await enqueue();
        const claims = await Promise.all(Array.from({ length: 6 }, () => internals.claimJob(['contract'])));

        expect(claims.filter(Boolean)).toHaveLength(1);
    });

    it('entrega na ordem de criação', async () => {
        const first = await enqueue();
        await enqueue();

        expect((await internals.claimJob(['contract']))?.evaluationId).toBe(first.id);
    });

    it('remove o trabalho, e com ele os cabeçalhos, ao concluir', async () => {
        await enqueue('contract', { loadTestOptions: { headers: { Authorization: 'segredo' } } });
        const job = await internals.claimJob(['contract']);

        await internals.runJob('[test]', job!, consumer(async () => undefined));

        expect(await jobs().count()).toBe(0);
    });

    it('devolve à fila em caso de falha e desiste na terceira tentativa', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onGiveUp = vi.fn(async () => undefined);
        const failing = consumer(async () => {
            throw new Error('falha');
        }, onGiveUp);
        await enqueue();

        for (let attempt = 1; attempt <= 3; attempt++) {
            const job = await internals.claimJob(['contract']);
            expect(job?.attempts).toBe(attempt);
            await internals.runJob('[test]', job!, failing);
        }

        expect(onGiveUp).toHaveBeenCalledOnce();
        expect(await jobs().count()).toBe(0);
        vi.restoreAllMocks();
    });

    it('recupera trabalhos órfãos e descarta os que esgotaram as tentativas', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        await enqueue();
        const recoverable = await internals.claimJob(['contract']);
        await enqueue();
        const exhausted = await internals.claimJob(['contract']);
        await jobs().update({ id: exhausted!.id }, { attempts: 3 });

        await evaluationQueue.recoverOrphanedJobs(['contract']);

        expect((await jobs().findOneByOrFail({ id: recoverable!.id })).status).toBe('PENDING');
        expect(await jobs().findOneBy({ id: exhausted!.id })).toBeNull();
        vi.restoreAllMocks();
    });

    it('não recupera órfãos de um tipo que a instância não consome', async () => {
        await enqueue('performance');
        const job = await internals.claimJob(['performance']);

        await evaluationQueue.recoverOrphanedJobs(['contract']);

        expect((await jobs().findOneByOrFail({ id: job!.id })).status).toBe('RUNNING');
    });
});

describe('ciclo de vida da avaliação', () => {
    const statusOf = async (id: string) => (await AppDataSource.getRepository(Evaluation).findOneByOrFail({ id })).status;

    it('segue de PENDING a COMPLETED com a nota', async () => {
        const { id } = await createEvaluation();

        expect(await lifecycle.start(id, [])).toBe(true);
        await lifecycle.complete(id, { finalScore: 87.5 });

        const stored = await AppDataSource.getRepository(Evaluation).findOneByOrFail({ id });
        expect(stored.status).toBe('COMPLETED');
        expect(stored.finalScore).toBe(87.5);
        expect(stored.finishedAt).not.toBeNull();
    });

    it('não reinicia nem altera uma avaliação encerrada', async () => {
        const { id } = await createEvaluation();
        await lifecycle.start(id, []);
        await lifecycle.complete(id, { finalScore: 90 });

        expect(await lifecycle.start(id, [])).toBe(false);
        await lifecycle.partial(id, { finalScore: null });
        await lifecycle.fail(id, { message: 'erro', code: 'EXECUTION_FAILED' });

        const stored = await AppDataSource.getRepository(Evaluation).findOneByOrFail({ id });
        expect(stored.status).toBe('COMPLETED');
        expect(stored.finalScore).toBe(90);
    });

    it('só completa a partir de RUNNING', async () => {
        const { id } = await createEvaluation();

        await lifecycle.complete(id, { finalScore: 90 });

        expect(await statusOf(id)).toBe('PENDING');
    });

    it('marca como falha a avaliação pendente que perdeu o trabalho', async () => {
        const orphan = await createEvaluation();
        const queued = await enqueue();

        const affected = await lifecycle.failOrphaned({ message: 'interrompida', code: 'EXECUTION_INTERRUPTED' });

        expect(affected).toBe(1);
        expect(await statusOf(orphan.id)).toBe('FAILED');
        expect(await statusOf(queued.id)).toBe('PENDING');
    });
});
