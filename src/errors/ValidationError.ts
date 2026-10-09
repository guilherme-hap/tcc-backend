import { AppError } from './AppError.js';

export interface IValidationIssue {
    path: string;
    message: string;
}

export class ValidationError extends AppError {
    constructor(public readonly issues: IValidationIssue[]) {
        super('VALIDATION_FAILED');
    }
}
