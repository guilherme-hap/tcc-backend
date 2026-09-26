import { Response } from 'express';
import { SavedApiService } from '../services/SavedApiService.js';
import { AppError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middlewares/optionalAuth.js';

export class SavedApiController {
    private service: SavedApiService;

    constructor() {
        this.service = new SavedApiService();
    }

    public create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { name, openApiUrl, apiBaseUrl, defaultSettings } = req.body;

        if (!name || !openApiUrl) {
            throw new AppError('Fields "name" and "openApiUrl" are required', 400);
        }

        const savedApi = await this.service.create(req.userId!, {
            name,
            openApiUrl,
            apiBaseUrl,
            defaultSettings,
        });

        res.status(201).json(savedApi);
    };

    public list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const savedApis = await this.service.listByUser(req.userId!);
        res.status(200).json(savedApis);
    };

    public update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { name, openApiUrl, apiBaseUrl, defaultSettings } = req.body;

        if (
            name === undefined &&
            openApiUrl === undefined &&
            apiBaseUrl === undefined &&
            defaultSettings === undefined
        ) {
            throw new AppError('At least one field must be provided for update', 400);
        }

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (openApiUrl !== undefined) data.openApiUrl = openApiUrl;
        if (apiBaseUrl !== undefined) data.apiBaseUrl = apiBaseUrl;
        if (defaultSettings !== undefined) data.defaultSettings = defaultSettings;

        const savedApi = await this.service.update(req.params.id as string, req.userId!, data);
        res.status(200).json(savedApi);
    };

    public delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.service.delete(req.params.id as string, req.userId!);
        res.status(200).json({ message: 'Saved API deleted successfully' });
    };
}
