import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { EvaluationStatus, EvaluationType, IPerformanceTarget, IPerformanceTargetResult } from '../interfaces/evaluation.interface.js';
import type { FailureCode, IFailedPillar, IPillarScores, IScoreBreakdown, IScoringParameters } from '../interfaces/evaluation.interface.js';
import { User } from './User.js';

@Entity('evaluations')
export class Evaluation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'user_id' })
    user!: User | null;

    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId!: string | null;

    @Column({ name: 'openapi_url', type: 'varchar' })
    openApiUrl!: string;

    @Column({ name: 'api_base_url', type: 'varchar', nullable: true })
    apiBaseUrl!: string | null;

    @Column({ name: 'targets', type: 'jsonb', nullable: true })
    targets!: IPerformanceTarget[] | null;

    @Column({ name: 'performance_results', type: 'jsonb', nullable: true })
    performanceResults!: IPerformanceTargetResult[] | null;

    @Column({ name: 'evaluation_type', type: 'varchar' })
    evaluationType!: EvaluationType;

    @Column({ name: 'status', type: 'varchar', default: 'PENDING' })
    status!: EvaluationStatus;

    @Column({ name: 'spectral_result', type: 'jsonb', nullable: true })
    spectralResult!: any;

    @Column({ name: 'security_result', type: 'jsonb', nullable: true })
    securityResult!: any;

    @Column({ name: 'final_score', type: 'float', nullable: true })
    finalScore!: number | null;

    @Column({ name: 'failed_pillars', type: 'jsonb', nullable: true })
    failedPillars!: IFailedPillar[] | null;

    @Column({ name: 'pillar_scores', type: 'jsonb', nullable: true })
    pillarScores!: IPillarScores | null;

    @Column({ name: 'scoring', type: 'jsonb', nullable: true })
    scoring!: IScoringParameters | null;

    @Column({ name: 'score_breakdown', type: 'jsonb', nullable: true })
    scoreBreakdown!: IScoreBreakdown | null;

    @Column({ name: 'error_message', type: 'varchar', nullable: true })
    errorMessage!: string | null;

    @Column({ name: 'error_code', type: 'varchar', nullable: true })
    errorCode!: FailureCode | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
