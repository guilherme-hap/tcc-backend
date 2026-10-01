import { Response } from 'express';
import { CustomRuleService } from '../services/CustomRuleService.js';
import type { CreateCustomRuleInput, UpdateCustomRuleInput } from '../schemas/customRule.schema.js';
import type { AuthenticatedRequest } from '../middlewares/optionalAuth.js';

export class CustomRuleController {
    private service: CustomRuleService;

    constructor() {
        this.service = new CustomRuleService();
    }

    public create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const customRule = await this.service.create(req.userId!, req.body as CreateCustomRuleInput);

        res.status(201).json(customRule);
    };

    public list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const customRules = await this.service.listByUser(req.userId!);
        res.status(200).json(customRules);
    };

    public update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const customRule = await this.service.update(req.params.id as string, req.userId!, req.body as UpdateCustomRuleInput);
        res.status(200).json(customRule);
    };

    public delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.service.delete(req.params.id as string, req.userId!);
        res.status(200).json({ message: 'Custom rule deleted successfully' });
    };
}
