import { Response } from 'express';
import { EvaluationUsecase } from '../usecases/EvaluationUsecase.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import type { EvaluationType } from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';
import { AuthenticatedRequest } from '../middlewares/optionalAuth.js';

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

    public getEvaluation = async (req: AuthenticatedRequest & { params: { id: string } }, res: Response): Promise<void> => {
        const evaluation = await this.lifecycle.findById(req.params.id);
        if (!evaluation) {
            throw new AppError('EVALUATION_NOT_FOUND');
        }
        if (evaluation.userId && evaluation.userId !== req.userId) {
            throw new AppError('EVALUATION_NOT_FOUND');
        }
        res.status(200).json(evaluation);
    };
}