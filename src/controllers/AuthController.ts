import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService.js';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response): Promise<void> => {
        const { email, password } = req.body;
        const result = await this.authService.register(email, password);

        res.status(201).json({
            user: { id: result.user.id, email: result.user.email },
            token: result.token,
        });
    };

    login = async (req: Request, res: Response): Promise<void> => {
        const { email, password } = req.body;
        const result = await this.authService.login(email, password);

        res.status(200).json({
            user: { id: result.user.id, email: result.user.email },
            token: result.token,
        });
    };
}
