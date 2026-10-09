import { AppError } from '../errors/AppError.js';
import type { IAuditMessage } from '../messages/catalog.js';
import type { ErrorMessageArgs } from '../messages/errors.js';
import type { PillarResults } from './types.js';

export class PillarError extends AppError {
    constructor(
        public partialResults: Partial<PillarResults>,
        ...args: ErrorMessageArgs
    ) {
        super(...args);
        this.name = 'PillarError';
    }
}

export class PillarSkipped extends Error {
    constructor(public audit: IAuditMessage) {
        super(audit.message);
        this.name = 'PillarSkipped';
    }
}
