import { Response } from 'express';
import { SavedApiService } from '../services/SavedApiService.js';
import type { CreateSavedApiInput, UpdateSavedApiInput } from '../schemas/savedApi.schema.js';
import type { AuthenticatedRequest } from '../middlewares/optionalAuth.js';

export class SavedApiController {
    private service: SavedApiService;

    constructor() {
        this.service = new SavedApiService();
    }

    public create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const savedApi = await this.service.create(req.userId!, req.body as CreateSavedApiInput);

        res.status(201).json(savedApi);
    };

    public list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const savedApis = await this.service.listByUser(req.userId!);
        res.status(200).json(savedApis);
    };

    public update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const savedApi = await this.service.update(req.params.id as string, req.userId!, req.body as UpdateSavedApiInput);
        res.status(200).json(savedApi);
    };

    public delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.service.delete(req.params.id as string, req.userId!);
        res.status(200).json({ message: 'Saved API deleted successfully' });
    };
}
