import { Request, Response } from 'express';
import { listSpectralRules } from '../utils/spectralRules.js';

export class RuleController {
    public list = (_req: Request, res: Response): void => {
        res.status(200).json(listSpectralRules());
    };
}
