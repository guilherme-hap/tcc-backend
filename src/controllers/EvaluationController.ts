import { Request, Response } from 'express';
import { ContractEvaluationUsecase } from '../usecases/ContractEvaluationUsecase.js';
import { PerformanceEvaluationUsecase } from '../usecases/PerformanceEvaluationUsecase.js';
import { FullEvaluationUsecase } from '../usecases/FullEvaluationUsecase.js';
import { EvaluationLifecycleService } from '../services/EvaluationLifecycleService.js';
import {
    IContractRequest,
    IPerformanceRequest,
    IFullEvaluationRequest,
} from '../interfaces/evaluation.interface.js';
import { AppError } from '../errors/AppError.js';

export class EvaluationController {
    private contractUsecase: ContractEvaluationUsecase;
    private performanceUsecase: PerformanceEvaluationUsecase;
    private fullUsecase: FullEvaluationUsecase;
    private lifecycle: EvaluationLifecycleService;

    constructor() {
        this.contractUsecase = new ContractEvaluationUsecase();
        this.performanceUsecase = new PerformanceEvaluationUsecase();
        this.fullUsecase = new FullEvaluationUsecase();
        this.lifecycle = new EvaluationLifecycleService();
    }

    public evaluateContract = async (req: Request<{}, {}, IContractRequest>, res: Response): Promise<void> => {
        const result = await this.contractUsecase.execute(req.body);
        res.status(202).json(result);
    };

    public evaluatePerformance = async (req: Request<{}, {}, IPerformanceRequest>, res: Response): Promise<void> => {
        const result = await this.performanceUsecase.execute(req.body);
        res.status(202).json(result);
    };

    public evaluateFull = async (req: Request<{}, {}, IFullEvaluationRequest>, res: Response): Promise<void> => {
        const result = await this.fullUsecase.execute(req.body);
        res.status(202).json(result);
    };

    public getEvaluation = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
        const evaluation = await this.lifecycle.findById(req.params.id);
        if (!evaluation) {
            throw new AppError('Avaliação não encontrada', 404);
        }
        res.status(200).json(evaluation);
    };
}