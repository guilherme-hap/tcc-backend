import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/data-source.js';
import { User } from '../entities/User.js';
import { AppError } from '../errors/AppError.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';
import { isUniqueViolation } from '../utils/isUniqueViolation.js';
import { jwtSecret } from '../utils/jwtSecret.js';

interface AuthResult {
    user: { id: string; email: string };
    token: string;
}

export class AuthService {
    private get repository() {
        return AppDataSource.getRepository(User);
    }

    async register({ email, password }: RegisterInput): Promise<AuthResult> {
        const existing = await this.repository.findOneBy({ email });
        if (existing) {
            throw new AppError('AUTH_EMAIL_IN_USE');
        }

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = this.repository.create({ email, passwordHash });
        try {
            await this.repository.save(user);
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('AUTH_EMAIL_IN_USE');
            }
            throw error;
        }

        return this.toAuthResult(user);
    }

    async login({ email, password }: LoginInput): Promise<AuthResult> {
        const user = await this.repository.findOneBy({ email });
        if (!user) {
            throw new AppError('AUTH_INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError('AUTH_INVALID_CREDENTIALS');
        }

        return this.toAuthResult(user);
    }

    async getById(userId: string): Promise<{ id: string; email: string }> {
        const user = await this.repository.findOneBy({ id: userId });
        if (!user) {
            throw new AppError('AUTH_INVALID_TOKEN');
        }

        return { id: user.id, email: user.email };
    }

    private toAuthResult(user: User): AuthResult {
        const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];
        const token = jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), { expiresIn });

        return { user: { id: user.id, email: user.email }, token };
    }
}
