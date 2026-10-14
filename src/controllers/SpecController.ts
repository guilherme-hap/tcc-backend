import { Request, Response } from 'express';
import { SpecService } from '../services/SpecService.js';
import type { SpecOperationsInput } from '../schemas/spec.schema.js';

export class SpecController {
    private service: SpecService;

    constructor() {
        this.service = new SpecService();
    }

    public listOperations = async (req: Request, res: Response): Promise<void> => {
        const operations = await this.service.listOperations(req.body as SpecOperationsInput);
        res.status(200).json(operations);
    };
}
