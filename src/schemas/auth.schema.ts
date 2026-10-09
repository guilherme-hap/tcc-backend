import { z } from 'zod';

export const registerSchema = z.object({
    email: z.email({ error: (issue) => (issue.input === undefined ? undefined : 'E-mail inválido') }),
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: z.string().min(1, 'Informe o e-mail'),
    password: z.string().min(1, 'Informe a senha'),
});

export type LoginInput = z.infer<typeof loginSchema>;
