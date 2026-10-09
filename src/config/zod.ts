import { z } from 'zod';

z.config(z.locales.ptBR());
z.config({
    customError: (issue) => (issue.code === 'invalid_type' && issue.input === undefined ? 'Campo obrigatório' : undefined),
});
