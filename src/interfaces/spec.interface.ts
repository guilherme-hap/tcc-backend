import type { HttpMethod } from '../schemas/shared.js';
import type { OasVersion } from './evaluation.interface.js';

export interface ISpecOperationParam {
    name: string;
    type: string | null;
}

export interface ISpecOperation {
    path: string;
    method: HttpMethod;
    operationId: string | null;
    summary: string | null;
    tags: string[];
    deprecated: boolean;
    mutating: boolean;
    pathParams: ISpecOperationParam[];
    hasJsonBody: boolean;
    requiresAuth: boolean;
}

export interface ISpecOperations {
    title: string | null;
    oasVersion: OasVersion | null;
    baseUrl: string;
    operations: ISpecOperation[];
}
