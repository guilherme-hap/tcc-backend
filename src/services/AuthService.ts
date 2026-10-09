import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/data-source.js';
import { User } from '../entities/User.js';
import { AppError } from '../errors/AppError.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.schema.js';

export class AuthService {
    private get repository() {
        return AppDataSource.getRepository(User);
    }

    async register({ email, password }: RegisterInput): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
        const existing = await this.repository.findOneBy({ email });
        if (existing) {
            throw new AppError('AUTH_EMAIL_IN_USE');
        }

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = this.repository.create({ email, passwordHash });
        await this.repository.save(user);

        const token = this.generateToken(user);

        const { passwordHash: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword as Omit<User, 'passwordHash'>, token };
    }

    async login({ email, password }: LoginInput): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
        const user = await this.repository.findOneBy({ email });
        if (!user) {
            throw new AppError('AUTH_INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError('AUTH_INVALID_CREDENTIALS');
        }

        const token = this.generateToken(user);

        const { passwordHash: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword as Omit<User, 'passwordHash'>, token };
    }

    private generateToken(user: User): string {
        if (!process.env.JWT_SECRET) {
            throw new AppError('INTERNAL_ERROR');
        }

        const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];

        return jwt.sign(
            { sub: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn },
        );
    }
}
