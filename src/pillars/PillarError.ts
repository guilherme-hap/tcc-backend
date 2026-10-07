import type { PillarResults } from './types.js';

export class PillarError extends Error {
    constructor(
        message: string,
        public partialResults: Partial<PillarResults>,
    ) {
        super(message);
        this.name = 'PillarError';
    }
}
