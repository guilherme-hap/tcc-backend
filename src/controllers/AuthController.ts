import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import type { AuthenticatedRequest } from '../middlewares/optionalAuth.js';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response): Promise<void> => {
        const result = await this.authService.register(req.body as RegisterInput);

        res.status(201).json(result);
    };

    login = async (req: Request, res: Response): Promise<void> => {
        const result = await this.authService.login(req.body as LoginInput);

        res.status(200).json(result);
    };

    me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const user = await this.authService.getById(req.userId!);

        res.status(200).json({ user });
    };
}
