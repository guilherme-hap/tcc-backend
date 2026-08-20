import { AppDataSource } from '../config/data-source.js';
import { Evaluation } from '../entities/Evaluation.js';
import { IEvaluationRequest } from '../interfaces/evaluation.interface.js';
import { SpectralService } from './SpectralService.js';
import { AppError } from '../errors/AppError.js';

export class EvaluationService {
    private spectralService: SpectralService;

    constructor() {
        this.spectralService = new SpectralService();
    }

    public async queueEvaluation(data: IEvaluationRequest) {
        const { swaggerUrl, baseUrl, rulesConfig } = data;

        if (!swaggerUrl) {
            throw new AppError('swaggerUrl is required', 400);
        }

        const evaluationRepository = AppDataSource.getRepository(Evaluation);
        const newEvaluation = evaluationRepository.create({
            swaggerUrl,
            baseUrl: baseUrl || null,
            status: 'PENDING',
        });

        const savedEvaluation = await evaluationRepository.save(newEvaluation);

        this.spectralService.processEvaluation(savedEvaluation.id, swaggerUrl, rulesConfig || {})
            .catch(console.error);

        return {
            message: 'Avaliação enfileirada com sucesso',
            evaluationId: savedEvaluation.id,
        };
    }
}
