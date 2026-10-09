import { In } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { AppDataSource } from '../config/data-source.js';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationType, IPerformanceTarget } from '../interfaces/evaluation.interface.js';

export class EvaluationLifecycleService {
    private get repository() {
        return AppDataSource.getRepository(Evaluation);
    }

    async create(data: {
        openApiUrl: string;
        apiBaseUrl?: string | null;
        targets?: IPerformanceTarget[] | null;
        evaluationType: EvaluationType;
        userId?: string | null;
    }): Promise<Evaluation> {
        const evaluation = this.repository.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl || null,
            targets: data.targets || null,
            evaluationType: data.evaluationType,
            userId: data.userId ?? null,
            status: 'PENDING',
        });
        return this.repository.save(evaluation);
    }

    async start(evaluationId: string): Promise<boolean> {
        const result = await this.repository.update(
            { id: evaluationId, status: In(['PENDING', 'RUNNING']) },
            { status: 'RUNNING' },
        );
        return (result.affected ?? 0) > 0;
    }

    async complete(evaluationId: string, results: Partial<Evaluation>): Promise<void> {
        await this.repository.update({ id: evaluationId, status: 'RUNNING' }, {
            ...results,
            status: 'COMPLETED',
        } as QueryDeepPartialEntity<Evaluation>);
    }

    async partial(evaluationId: string, results: Partial<Evaluation>): Promise<void> {
        await this.repository.update({ id: evaluationId, status: 'RUNNING' }, {
            ...results,
            status: 'PARTIAL',
        } as QueryDeepPartialEntity<Evaluation>);
    }

    async fail(
        evaluationId: string,
        error: string | Error,
        extraResults?: Partial<Pick<Evaluation, 'performanceResults' | 'spectralResult' | 'securityResult' | 'failedPillars'>>,
    ): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : error;
        await this.repository.update({ id: evaluationId, status: In(['PENDING', 'RUNNING']) }, {
            ...(extraResults ?? {}),
            status: 'FAILED',
            errorMessage,
        } as QueryDeepPartialEntity<Evaluation>);
    }

    async findById(evaluationId: string): Promise<Evaluation | null> {
        return this.repository.findOneBy({ id: evaluationId });
    }
}
