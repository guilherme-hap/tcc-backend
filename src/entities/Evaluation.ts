import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Relation } from 'typeorm';
import type { EvaluationStatus, EvaluationType, IPerformanceTarget, IPerformanceTargetResult } from '../interfaces/evaluation.interface.js';
import type { FailureCode, IContractResult, IEvaluationRequestSettings, IFailedPillar, IPillarScores, IScoreBreakdown, IScoringParameters, ISecurityCheckResult } from '../interfaces/evaluation.interface.js';
import { User } from './User.js';

@Entity('evaluations')
@Index(['userId', 'createdAt'])
export class Evaluation {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'user_id' })
    user!: Relation<User> | null;

    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId!: string | null;

    @Column({ name: 'openapi_url', type: 'varchar' })
    openApiUrl!: string;

    @Column({ name: 'api_base_url', type: 'varchar', nullable: true })
    apiBaseUrl!: string | null;

    @Column({ name: 'targets', type: 'jsonb', nullable: true })
    targets!: IPerformanceTarget[] | null;

    @Column({ name: 'request_settings', type: 'jsonb', nullable: true })
    requestSettings!: IEvaluationRequestSettings | null;

    @Column({ name: 'performance_results', type: 'jsonb', nullable: true })
    performanceResults!: IPerformanceTargetResult[] | null;

    @Column({ name: 'evaluation_type', type: 'varchar' })
    evaluationType!: EvaluationType;

    @Column({ name: 'status', type: 'varchar', default: 'PENDING' })
    status!: EvaluationStatus;

    @Column({ name: 'spectral_result', type: 'jsonb', nullable: true })
    spectralResult!: IContractResult | null;

    @Column({ name: 'security_result', type: 'jsonb', nullable: true })
    securityResult!: ISecurityCheckResult[] | null;

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

    @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
    startedAt!: Date | null;

    @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
    finishedAt!: Date | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
