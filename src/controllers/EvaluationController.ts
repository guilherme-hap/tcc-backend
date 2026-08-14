import { Request, Response } from 'express';
import { SpectralService } from '../services/SpectralService.js';
import { IEvaluationRequest } from '../interfaces/evaluation.interface.js';

export class EvaluationController {
    private spectralService: SpectralService;

    constructor() {
        this.spectralService = new SpectralService();
    }

    public evaluateContract = async (req: Request, res: Response): Promise<void> => {
        try {
            const { swaggerUrl } = req.body as IEvaluationRequest;

            if (!swaggerUrl) {
                res.status(400).json({ error: 'swaggerUrl is required' });
                return;
            }

            const results = await this.spectralService.evaluateContract(swaggerUrl);
            
            res.status(200).json({
                message: 'Evaluation completed successfully',
                data: results
            });
        } catch (error) {
            console.error('Error evaluating contract:', error);
            res.status(500).json({ error: 'Internal server error during contract evaluation' });
        }
    }
}
