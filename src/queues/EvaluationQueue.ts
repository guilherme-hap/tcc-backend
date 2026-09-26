import pg from 'pg';
import { AppDataSource } from '../config/data-source.js';
import { EvaluationJob as EvaluationJobEntity } from '../entities/EvaluationJob.js';
import {
    EvaluationType,
    IContractRequest,
    IPerformanceRequest,
    ISecurityRequest,
    IFullEvaluationRequest,
} from '../interfaces/evaluation.interface.js';

export interface EvaluationJob {
    evaluationId: string;
    type: EvaluationType;
    params: IContractRequest | IPerformanceRequest | ISecurityRequest | IFullEvaluationRequest;
}

type JobHandler = (job: EvaluationJob) => Promise<void>;

function createWakeTrigger() {
    let resolve: () => void;
    let promise = new Promise<void>((r) => { resolve = r; });

    return {
        wait: () => promise,
        wake: () => {
            resolve();
            promise = new Promise<void>((r) => { resolve = r; });
        },
    };
}

class PostgresEvaluationQueue {
    async enqueue(job: EvaluationJob): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            await queryRunner.manager.save(EvaluationJobEntity, {
                evaluationId: job.evaluationId,
                type: job.type,
                payload: job.params as Record<string, any>,
                status: 'PENDING' as const,
            });
            await queryRunner.query(`NOTIFY evaluation_jobs_${job.type}`);
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
    async listen(
        type: EvaluationType,
        concurrency: number,
        handler: JobHandler,
    ): Promise<void> {
        const channelName = `evaluation_jobs_${type}`;
        const trigger = createWakeTrigger();

        const connectListener = async (): Promise<pg.Client> => {
            const client = new pg.Client({
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT) || 5432,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || 'root',
                database: process.env.DB_NAME || 'tcc_db',
            });

            await client.connect();
            await client.query(`LISTEN ${channelName}`);

            client.on('notification', () => {
                trigger.wake();
            });

            client.on('error', (err: Error) => {
                console.error(`[Queue][${type}] LISTEN connection error:`, err.message);
                reconnect();
            });

            console.log(`[Queue][${type}] LISTEN connected on channel "${channelName}"`);
            return client;
        };

        let listenerClient: pg.Client | null = null;

        const reconnect = async () => {
            listenerClient = null;
            let delay = 1000;
            const maxDelay = 30000;

            while (true) {
                try {
                    console.log(`[Queue][${type}] Reconnecting LISTEN in ${delay}ms…`);
                    await new Promise((r) => setTimeout(r, delay));
                    listenerClient = await connectListener();
                    trigger.wake();
                    return;
                } catch (err: any) {
                    console.error(`[Queue][${type}] Reconnection failed:`, err.message);
                    delay = Math.min(delay * 2, maxDelay);
                }
            }
        };

        listenerClient = await connectListener();

        for (let i = 0; i < concurrency; i++) {
            this.consumerLoop(type, i, trigger, handler);
        }

        console.log(`[Queue][${type}] ${concurrency} consumer loop(s) started`);
    }

    private async consumerLoop(
        type: EvaluationType,
        loopIndex: number,
        trigger: ReturnType<typeof createWakeTrigger>,
        handler: JobHandler,
    ): Promise<void> {
        const tag = `[Queue][${type}][loop-${loopIndex}]`;

        while (true) {
            try {
                const job = await this.claimJob(type);

                if (job) {
                    try {
                        await handler(job);
                        await this.markJobDone(job.id);
                    } catch (handlerErr: any) {
                        console.error(`${tag} Handler error for job ${job.id}:`, handlerErr.message);
                        await this.markJobFailed(job.id);
                    }
                    continue;
                }
                await trigger.wait();
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
                type: rawRow.type as EvaluationType,
                params: rawRow.payload as EvaluationJob['params'],
            };
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    private async markJobDone(jobId: string): Promise<void> {
        await AppDataSource.getRepository(EvaluationJobEntity)
            .update(jobId, { status: 'DONE' });
    }

    private async markJobFailed(jobId: string): Promise<void> {
        await AppDataSource.getRepository(EvaluationJobEntity)
            .update(jobId, { status: 'FAILED' });
    }
}

export const evaluationQueue = new PostgresEvaluationQueue();
