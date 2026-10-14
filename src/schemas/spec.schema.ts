import { z } from 'zod';
import { httpUrl } from './shared.js';

export const specOperationsRequestSchema = z.object({
    openApiUrl: httpUrl,
});

export type SpecOperationsInput = z.infer<typeof specOperationsRequestSchema>;
