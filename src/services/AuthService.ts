import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/data-source.js';
import { User } from '../entities/User.js';
import { AppError } from '../errors/AppError.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
    private get repository() {
        return AppDataSource.getRepository(User);
    }

    async register(email: string, password: string): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
        if (!email || !EMAIL_REGEX.test(email)) {
            throw new AppError('Invalid email format', 400);
        }

        if (!password || password.length < 8) {
            throw new AppError('Password must be at least 8 characters long', 400);
        }

        const existing = await this.repository.findOneBy({ email });
        if (existing) {
            throw new AppError('Email already in use', 409);
        }

        const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const user = this.repository.create({ email, passwordHash });
        await this.repository.save(user);

        const token = this.generateToken(user);

        const { passwordHash: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword as Omit<User, 'passwordHash'>, token };
    }

    async login(email: string, password: string): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
        const user = await this.repository.findOneBy({ email });
        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new AppError('Invalid credentials', 401);
        }

        const token = this.generateToken(user);

        const { passwordHash: _, ...userWithoutPassword } = user;
        return { user: userWithoutPassword as Omit<User, 'passwordHash'>, token };
    }

    private generateToken(user: User): string {
        if (!process.env.JWT_SECRET) {
            throw new AppError('JWT_SECRET is not configured', 500);
        }

        const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'];

        return jwt.sign(
            { sub: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn },
        );
    }
}
