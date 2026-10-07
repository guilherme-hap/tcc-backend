import type { IAuditMessage } from '../messages/catalog.js';
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

export class PillarSkipped extends Error {
    constructor(public audit: IAuditMessage) {
        super(audit.message);
        this.name = 'PillarSkipped';
    }
}
