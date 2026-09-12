import {
    Entity, PrimaryGeneratedColumn, Column,
    CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import type { EvaluationType } from '../interfaces/evaluation.interface.js';

export type EvaluationJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

@Entity('evaluation_jobs')
@Index('IDX_evaluation_jobs_poll', ['type', 'status', 'createdAt'])
export class EvaluationJob {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'evaluation_id', type: 'uuid' })
    evaluationId!: string;

    @Column({ name: 'type', type: 'varchar' })
    type!: EvaluationType;

    @Column({ name: 'payload', type: 'jsonb' })
    payload!: Record<string, any>;

    @Column({ name: 'status', type: 'varchar', default: 'PENDING' })
    status!: EvaluationJobStatus;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
