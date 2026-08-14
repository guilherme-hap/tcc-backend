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
                res.status(400).json({ message: "The 'swaggerUrl' property is required." });
                return;
            }

            const results = await this.spectralService.evaluateContract(swaggerUrl);
            
            res.status(200).json(results);
        } catch (error: any) {
            console.error('Error evaluating contract:', error);
            
            const errorMessage = error instanceof Error ? error.message : 'Internal server error during contract evaluation';
            res.status(500).json({ message: errorMessage });
        }
    }
}