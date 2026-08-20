import { Request, Response } from 'express';
import { EvaluationService } from '../services/EvaluationService.js';
import { IEvaluationRequest } from '../interfaces/evaluation.interface.js';

export class EvaluationController {
    private evaluationService: EvaluationService;

    constructor() {
        this.evaluationService = new EvaluationService();
    }

    public evaluateApi = async (req: Request<{}, {}, IEvaluationRequest>, res: Response): Promise<void> => {
        const result = await this.evaluationService.queueEvaluation(req.body);
        res.status(202).json(result);
    };
}
