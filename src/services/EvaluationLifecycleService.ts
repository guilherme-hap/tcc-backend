import { AppDataSource } from '../config/data-source.js';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationType } from '../interfaces/evaluation.interface.js';

export class EvaluationLifecycleService {
    private get repository() {
        return AppDataSource.getRepository(Evaluation);
    }

    async create(data: {
        swaggerUrl: string;
        baseUrl?: string | null;
        evaluationType: EvaluationType;
    }): Promise<Evaluation> {
        const evaluation = this.repository.create({
            swaggerUrl: data.swaggerUrl,
            baseUrl: data.baseUrl || null,
            evaluationType: data.evaluationType,
            status: 'PENDING',
        });
        return this.repository.save(evaluation);
    }

    async start(evaluationId: string): Promise<void> {
        await this.repository.update(evaluationId, { status: 'RUNNING' });
    }

    async complete(evaluationId: string, results: Partial<Evaluation>): Promise<void> {
        await this.repository.update(evaluationId, {
            ...results,
            status: 'COMPLETED',
        });
    }

    async partial(evaluationId: string, results: Partial<Evaluation>): Promise<void> {
        await this.repository.update(evaluationId, {
            ...results,
            status: 'PARTIAL',
        });
    }

    async fail(evaluationId: string, error: string | Error): Promise<void> {
        const errorMessage = error instanceof Error ? error.message : error;
        await this.repository.update(evaluationId, {
            status: 'FAILED',
            errorMessage,
        });
    }

    async findById(evaluationId: string): Promise<Evaluation | null> {
        return this.repository.findOneBy({ id: evaluationId });
    }
}
