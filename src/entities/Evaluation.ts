import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import type { EvaluationStatus, EvaluationType } from '../interfaces/evaluation.interface.js';
import type { IFailedPillar } from '../interfaces/evaluation.interface.js';

@Entity('evaluations')
export class Evaluation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ name: 'swagger_url', type: 'varchar' })
    swaggerUrl!: string;

    @Column({ name: 'base_url', type: 'varchar', nullable: true })
    baseUrl!: string | null;

    @Column({ name: 'evaluation_type', type: 'varchar' })
    evaluationType!: EvaluationType;

    @Column({ name: 'status', type: 'varchar', default: 'PENDING' })
    status!: EvaluationStatus;

    @Column({ name: 'spectral_result', type: 'json', nullable: true })
    spectralResult!: any;

    @Column({ name: 'autocannon_result', type: 'json', nullable: true })
    autocannonResult!: any;

    @Column({ name: 'security_result', type: 'json', nullable: true })
    securityResult!: any;

    @Column({ name: 'final_score', type: 'float', nullable: true })
    finalScore!: number | null;

    @Column({ name: 'failed_pillars', type: 'json', nullable: true })
    failedPillars!: IFailedPillar[] | null;

    @Column({ name: 'error_message', type: 'varchar', nullable: true })
    errorMessage!: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
