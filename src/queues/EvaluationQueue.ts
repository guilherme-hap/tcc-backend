import pg from 'pg';
import { AppDataSource } from '../config/data-source.js';
import { dbConnection } from '../config/database.js';
import { EvaluationJob as EvaluationJobEntity, EvaluationJobStatus } from '../entities/EvaluationJob.js';
import type { EvaluationJob, EvaluationJobOf, EvaluationType } from '../interfaces/evaluation.interface.js';

type JobHandler = (job: EvaluationJob) => Promise<void>;

export interface QueueConsumer {
    type: EvaluationType;
    concurrency: number;
    handler: JobHandler;
}

const IDLE_POLL_INTERVAL_MS = 30_000;
const LISTEN_MAX_RECONNECT_DELAY_MS = 30_000;

function channelOf(type: EvaluationType): string {
    return `evaluation_jobs_${type}`;
}

function createWakeTrigger() {
    let generation = 0;
    const waiters = new Set<() => void>();

    return {
        generation: () => generation,
        wake: () => {
            generation++;
            for (const release of waiters) release();
        },
        waitSince: (seenGeneration: number, timeoutMs: number) => new Promise<void>((resolve) => {
            if (generation !== seenGeneration) return resolve();

            const release = () => {
                clearTimeout(timer);
                waiters.delete(release);
                resolve();
            };
            const timer = setTimeout(release, timeoutMs);
            waiters.add(release);
        }),
    };
}

type WakeTrigger = ReturnType<typeof createWakeTrigger>;

class PostgresEvaluationQueue {
    private triggers = new Map<string, WakeTrigger>();

    async enqueue<T extends EvaluationType>(job: EvaluationJobOf<T>): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.save(EvaluationJobEntity, {
                evaluationId: job.evaluationId,
                type: job.type,
                payload: job.params,
                status: 'PENDING' as const,
            });
            await queryRunner.query(`NOTIFY ${channelOf(job.type)}`);
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    async recoverOrphanedJobs(): Promise<void> {
        const result = await AppDataSource.getRepository(EvaluationJobEntity)
            .createQueryBuilder()
            .update(EvaluationJobEntity)
            .set({ status: 'PENDING' })
            .where('status = :status', { status: 'RUNNING' })
            .execute();

        const count = result.affected ?? 0;
        if (count > 0) {
            console.log(`[Queue] Recovered ${count} orphaned jobs on startup`);
        }
    }

    async start(consumers: QueueConsumer[]): Promise<void> {
        for (const { type } of consumers) {
            this.triggers.set(channelOf(type), createWakeTrigger());
        }

        await this.connectListener();

        for (const { type, concurrency, handler } of consumers) {
            const trigger = this.triggers.get(channelOf(type))!;
            for (let i = 0; i < concurrency; i++) {
                this.consumerLoop(type, i, trigger, handler);
            }
            console.log(`[Queue][${type}] ${concurrency} consumer loop(s) started`);
        }
    }

    private async connectListener(): Promise<void> {
        const client = new pg.Client(dbConnection);
        let active = false;

        client.on('error', (err: Error) => {
            console.error('[Queue] LISTEN connection error:', err.message);
            if (!active) return;
            active = false;
            client.end().catch(() => {});
            this.reconnectListener();
        });
        client.on('notification', (msg) => this.triggers.get(msg.channel)?.wake());

        try {
            await client.connect();
            for (const channel of this.triggers.keys()) {
                await client.query(`LISTEN ${channel}`);
            }
        } catch (err) {
            await client.end().catch(() => {});
            throw err;
        }

        active = true;
        console.log(`[Queue] LISTEN connected on ${this.triggers.size} channel(s)`);
    }

    private async reconnectListener(): Promise<void> {
        let delay = 1000;

        while (true) {
            try {
                console.log(`[Queue] Reconnecting LISTEN in ${delay}ms…`);
                await new Promise((r) => setTimeout(r, delay));
                await this.connectListener();
                for (const trigger of this.triggers.values()) trigger.wake();
                return;
            } catch (err: any) {
                console.error('[Queue] Reconnection failed:', err.message);
                delay = Math.min(delay * 2, LISTEN_MAX_RECONNECT_DELAY_MS);
            }
        }
    }

    private async consumerLoop(
        type: EvaluationType,
        loopIndex: number,
        trigger: WakeTrigger,
        handler: JobHandler,
    ): Promise<void> {
        const tag = `[Queue][${type}][loop-${loopIndex}]`;

        while (true) {
            try {
                const seenGeneration = trigger.generation();
                const job = await this.claimJob(type);

                if (job) {
                    try {
                        await handler(job);
                        await this.finishJob(job.id, 'DONE');
                    } catch (handlerErr: any) {
                        console.error(`${tag} Handler error for job ${job.id}:`, handlerErr.message);
                        await this.finishJob(job.id, 'FAILED');
                    }
                    continue;
                }
                await trigger.waitSince(seenGeneration, IDLE_POLL_INTERVAL_MS);
            } catch (loopErr: any) {
                console.error(`${tag} Loop error (will retry in 1s):`, loopErr.message);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    }

    private async claimJob(
        type: EvaluationType,
    ): Promise<(EvaluationJob & { id: string }) | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const rows: EvaluationJobEntity[] = await queryRunner.query(
                `SELECT * FROM evaluation_jobs
                 WHERE status = 'PENDING' AND type = $1
                 ORDER BY created_at
                 LIMIT 1
                 FOR UPDATE SKIP LOCKED`,
                [type],
            );

            if (rows.length === 0) {
                await queryRunner.rollbackTransaction();
                return null;
            }

            const row = rows[0];

            await queryRunner.query(
                `UPDATE evaluation_jobs SET status = 'RUNNING', updated_at = NOW() WHERE id = $1`,
                [row.id],
            );

            await queryRunner.commitTransaction();

            const rawRow = row as Record<string, any>;

            return {
                id: rawRow.id as string,
                evaluationId: (rawRow.evaluation_id ?? rawRow.evaluationId) as string,
                type: rawRow.type,
                params: rawRow.payload,
            } as EvaluationJob & { id: string };
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    private async finishJob(jobId: string, status: Extract<EvaluationJobStatus, 'DONE' | 'FAILED'>): Promise<void> {
        await AppDataSource.query(
            `UPDATE evaluation_jobs
             SET status = $2,
                 payload = payload #- '{loadTestOptions,headers}' #- '{loadTestOptions,body}',
                 updated_at = NOW()
             WHERE id = $1`,
            [jobId, status],
        );
    }
}

export const evaluationQueue = new PostgresEvaluationQueue();
