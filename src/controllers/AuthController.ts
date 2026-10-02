import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response): Promise<void> => {
        const result = await this.authService.register(req.body as RegisterInput);

        res.status(201).json({
            user: { id: result.user.id, email: result.user.email },
            token: result.token,
        });
    };

    login = async (req: Request, res: Response): Promise<void> => {
        const result = await this.authService.login(req.body as LoginInput);

        res.status(200).json({
            user: { id: result.user.id, email: result.user.email },
            token: result.token,
        });
    };
}
