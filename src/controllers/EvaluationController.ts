import { Response } from 'express';
import { EvaluationUsecase } from '../usecases/EvaluationUsecase.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import type { EvaluationType } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../middlewares/optionalAuth.js';
import type { Evaluation } from '../entities/Evaluation.js';
import { parseOrThrow } from '../utils/parseOrThrow.js';
import { listEvaluationsQuerySchema } from '../schemas/evaluation.schema.js';
import { evaluationPassed } from '../utils/qualityGate.js';

function toEvaluationResponse(evaluation: Evaluation) {
    return {
        id: evaluation.id,
        openApiUrl: evaluation.openApiUrl,
        apiBaseUrl: evaluation.apiBaseUrl,
        targets: evaluation.targets,
        requestSettings: evaluation.requestSettings,
        evaluationType: evaluation.evaluationType,
        visibility: evaluation.userId ? 'private' : 'anonymous',
        status: evaluation.status,
        finalScore: evaluation.finalScore,
        passed: evaluationPassed(evaluation),
        pillarScores: evaluation.pillarScores,
        scoring: evaluation.scoring,
        scoreBreakdown: evaluation.scoreBreakdown,
        spectralResult: evaluation.spectralResult,
        performanceResults: evaluation.performanceResults,
        securityResult: evaluation.securityResult,
        failedPillars: evaluation.failedPillars,
        errorMessage: evaluation.errorMessage,
        errorCode: evaluation.errorCode,
        startedAt: evaluation.startedAt,
        finishedAt: evaluation.finishedAt,
        createdAt: evaluation.createdAt,
        updatedAt: evaluation.updatedAt,
    };
}

export class EvaluationController {
    private usecase: EvaluationUsecase;
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.usecase = new EvaluationUsecase();
        this.lifecycle = new EvaluationLifecycleService();
    }

    public evaluate = (type: EvaluationType) => async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const result = await this.usecase.execute(type, req.body, req.userId);
        res.status(202).json(result);
    };

    public listEvaluations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const query = parseOrThrow(listEvaluationsQuerySchema, req.query);
        const { items, total } = await this.lifecycle.listByUser(req.userId!, query);

        res.status(200).json({
            items: items.map((evaluation) => ({
                id: evaluation.id,
                evaluationType: evaluation.evaluationType,
                status: evaluation.status,
                finalScore: evaluation.finalScore,
                openApiUrl: evaluation.openApiUrl,
                createdAt: evaluation.createdAt,
            })),
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        });
    };

    public getEvaluation = async (req: AuthenticatedRequest & { params: { id: string } }, res: Response): Promise<void> => {
        const evaluation = await this.lifecycle.findById(req.params.id);
        if (!evaluation) {
            throw new AppError('EVALUATION_NOT_FOUND');
        }
        if (evaluation.userId && evaluation.userId !== req.userId) {
            throw new AppError('EVALUATION_NOT_FOUND');
        }
        res.status(200).json(toEvaluationResponse(evaluation));
    };
}