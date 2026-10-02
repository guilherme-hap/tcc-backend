import { z } from 'zod';

export const registerSchema = z.object({
    email: z.email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z.string().min(1, 'email is required'),
    password: z.string().min(1, 'password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
