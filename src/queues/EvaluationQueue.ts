import pg from 'pg';
import { LessThan } from 'typeorm';
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/data-source.js';
import { dbConnection } from '../config/database.js';
import { EvaluationJob as EvaluationJobEntity } from '../entities/EvaluationJob.js';
import type { EvaluationJob, EvaluationJobOf, EvaluationType } from '../interfaces/evaluation.interface.js';

type JobHandler = (job: EvaluationJob) => Promise<void>;

type ClaimedJob = EvaluationJob & { id: string; attempts: number };

interface JobRow {
    id: string;
    evaluation_id: string;
    type: EvaluationType;
    payload: unknown;
    attempts: number;
}

export interface QueueConsumer {
    type: EvaluationType;
    concurrency: number;
    handler: JobHandler;
    onGiveUp: JobHandler;
}

const IDLE_POLL_INTERVAL_MS = 30_000;
const LISTEN_MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_JOB_ATTEMPTS = 3;

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

    async enqueue<T extends EvaluationType>(job: EvaluationJobOf<T>, manager: EntityManager): Promise<void> {
        await manager.save(EvaluationJobEntity, {
            evaluationId: job.evaluationId,
            type: job.type,
            payload: job.params,
            status: 'PENDING' as const,
        });
        await manager.query(`NOTIFY ${channelOf(job.type)}`);
    }

    async recoverOrphanedJobs(): Promise<void> {
        const repository = AppDataSource.getRepository(EvaluationJobEntity);

        const requeued = await repository.update(
            { status: 'RUNNING', attempts: LessThan(MAX_JOB_ATTEMPTS) },
            { status: 'PENDING' },
        );
        const abandoned = await repository.delete({ status: 'RUNNING' });

        if (requeued.affected) {
            console.log(`[Queue] Recovered ${requeued.affected} orphaned jobs on startup`);
        }
        if (abandoned.affected) {
            console.log(`[Queue] Dropped ${abandoned.affected} orphaned jobs after ${MAX_JOB_ATTEMPTS} attempts`);
        }
    }

    async start(consumers: QueueConsumer[]): Promise<void> {
        for (const { type } of consumers) {
            this.triggers.set(channelOf(type), createWakeTrigger());
        }

        await this.connectListener();

        for (const consumer of consumers) {
            const trigger = this.triggers.get(channelOf(consumer.type))!;
            for (let i = 0; i < consumer.concurrency; i++) {
                this.consumerLoop(consumer, i, trigger);
            }
            console.log(`[Queue][${consumer.type}] ${consumer.concurrency} consumer loop(s) started`);
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

    private async consumerLoop(consumer: QueueConsumer, loopIndex: number, trigger: WakeTrigger): Promise<void> {
        const tag = `[Queue][${consumer.type}][loop-${loopIndex}]`;

        while (true) {
            try {
                const seenGeneration = trigger.generation();
                const job = await this.claimJob(consumer.type);

                if (job) {
                    await this.runJob(tag, job, consumer);
                    continue;
                }
                await trigger.waitSince(seenGeneration, IDLE_POLL_INTERVAL_MS);
            } catch (loopErr: any) {
                console.error(`${tag} Loop error (will retry in 1s):`, loopErr.message);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    }

    private async runJob(tag: string, job: ClaimedJob, { handler, onGiveUp }: QueueConsumer): Promise<void> {
        try {
            await handler(job);
        } catch (handlerErr: any) {
            console.error(
                `${tag} Handler error for job ${job.id} (attempt ${job.attempts}/${MAX_JOB_ATTEMPTS}):`,
                handlerErr.message,
            );
            if (job.attempts < MAX_JOB_ATTEMPTS) {
                await this.requeueJob(job.id);
                return;
            }
            await onGiveUp(job);
        }
        await this.removeJob(job.id);
    }

    private async claimJob(type: EvaluationType): Promise<ClaimedJob | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const rows: JobRow[] = await queryRunner.query(
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
            const attempts = row.attempts + 1;

            await queryRunner.query(
                `UPDATE evaluation_jobs SET status = 'RUNNING', attempts = $2, updated_at = NOW() WHERE id = $1`,
                [row.id, attempts],
            );

            await queryRunner.commitTransaction();

            return {
                id: row.id,
                evaluationId: row.evaluation_id,
                type: row.type,
                params: row.payload,
                attempts,
            } as ClaimedJob;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    private async requeueJob(jobId: string): Promise<void> {
        await AppDataSource.query(
            `UPDATE evaluation_jobs SET status = 'PENDING', updated_at = NOW() WHERE id = $1`,
            [jobId],
        );
    }

    private async removeJob(jobId: string): Promise<void> {
        await AppDataSource.query(`DELETE FROM evaluation_jobs WHERE id = $1`, [jobId]);
    }
}

export const evaluationQueue = new PostgresEvaluationQueue();
