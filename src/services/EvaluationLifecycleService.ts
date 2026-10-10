import { And, ILike, In, LessThan, MoreThanOrEqual } from 'typeorm';
import type { FindOperator, FindOptionsWhere } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { AppDataSource } from '../config/data-source.js';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationType, FailureCode, IEvaluationRequestSettings, IPerformanceTarget } from '../interfaces/evaluation.interface.js';
import type { ListEvaluationsQuery } from '../schemas/evaluation.schema.js';

function escapeLikePattern(term: string): string {
    return term.replace(/[\\%_]/g, '\\$&');
}

export class EvaluationLifecycleService {
    private get repository() {
        return AppDataSource.getRepository(Evaluation);
    }

    async create(data: {
        openApiUrl: string;
        apiBaseUrl?: string | null;
        targets?: IPerformanceTarget[] | null;
        requestSettings?: IEvaluationRequestSettings | null;
        evaluationType: EvaluationType;
        userId?: string | null;
    }): Promise<Evaluation> {
        const evaluation = this.repository.create({
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl || null,
            targets: data.targets || null,
            requestSettings: data.requestSettings ?? null,
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
        failure: { message: string; code: FailureCode },
        extraResults?: Partial<Pick<Evaluation, 'performanceResults' | 'spectralResult' | 'securityResult' | 'failedPillars'>>,
    ): Promise<void> {
        await this.repository.update({ id: evaluationId, status: In(['PENDING', 'RUNNING']) }, {
            ...(extraResults ?? {}),
            status: 'FAILED',
            errorMessage: failure.message,
            errorCode: failure.code,
        } as QueryDeepPartialEntity<Evaluation>);
    }

    async findById(evaluationId: string): Promise<Evaluation | null> {
        return this.repository.findOneBy({ id: evaluationId });
    }

    async listByUser(userId: string, query: ListEvaluationsQuery): Promise<{ items: Evaluation[]; total: number }> {
        const where: FindOptionsWhere<Evaluation> = { userId };

        if (query.search) where.openApiUrl = ILike(`%${escapeLikePattern(query.search)}%`);
        if (query.type) where.evaluationType = query.type;
        if (query.status) where.status = In(query.status);

        const period: FindOperator<Date>[] = [];
        if (query.from) period.push(MoreThanOrEqual(new Date(query.from)));
        if (query.to) period.push(LessThan(new Date(query.to)));
        if (period.length > 0) where.createdAt = And(...period);

        const [items, total] = await this.repository.findAndCount({
            select: { id: true, evaluationType: true, status: true, finalScore: true, openApiUrl: true, createdAt: true },
            where,
            order: { createdAt: 'DESC', id: 'DESC' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        });

        return { items, total };
    }
}
