import { AppError } from '../errors/AppError.js';
import type { OasVersion } from '../interfaces/evaluation.interface.js';
import type { ISpecOperation, ISpecOperationParam, ISpecOperations } from '../interfaces/spec.interface.js';
import { httpMethodEnum } from '../schemas/shared.js';
import type { HttpMethod } from '../schemas/shared.js';
import { isRecord } from './fetchOpenApiSpec.js';
import { findRequestBodySchema } from './findOperationSchema.js';
import { acceptsRequestBody, isMutatingMethod, pathPlaceholders } from './httpMethodUtils.js';
import { resolveBaseUrlFromSpec } from './resolveBaseUrl.js';
import { collectParameterDefs } from './resolvePathParameters.js';
import { resolveRef } from './specRefs.js';

function detectOasVersion(spec: any): OasVersion | null {
    if (spec.swagger !== undefined) {
        return String(spec.swagger).startsWith('2') ? '2.0' : null;
    }

    const declared = String(spec.openapi);
    if (declared.startsWith('3.1')) return '3.1';
    if (declared === '3' || declared.startsWith('3.0')) return '3.0';
    return null;
}

function describePathParam(spec: any, name: string, definition: any): ISpecOperationParam {
    const declared = resolveRef(spec, definition?.schema)?.type ?? definition?.type;
    const type = Array.isArray(declared) ? declared.find((item) => item !== 'null') : declared;

    return { name, type: typeof type === 'string' ? type : null };
}

function requiresAuthentication(spec: any, operation: any): boolean {
    const security = operation.security ?? spec.security;

    return Array.isArray(security)
        && security.length > 0
        && security.every((requirement) => isRecord(requirement) && Object.keys(requirement).length > 0);
}

function describeOperation(spec: any, path: string, method: HttpMethod, operation: any): ISpecOperation {
    const parameters = collectParameterDefs(spec, path, method.toLowerCase());

    return {
        path,
        method,
        operationId: typeof operation.operationId === 'string' ? operation.operationId : null,
        summary: typeof operation.summary === 'string' ? operation.summary : null,
        tags: Array.isArray(operation.tags) ? operation.tags.filter((tag: unknown) => typeof tag === 'string') : [],
        deprecated: operation.deprecated === true,
        mutating: isMutatingMethod(method),
        pathParams: pathPlaceholders(path).map((name) => describePathParam(spec, name, parameters.get(name))),
        hasJsonBody: acceptsRequestBody(method) && Boolean(findRequestBodySchema(spec, path, method)),
        requiresAuth: requiresAuthentication(spec, operation),
    };
}

export function listSpecOperations(spec: any, openApiUrl: string): ISpecOperations {
    if (spec.openapi === undefined && spec.swagger === undefined) {
        throw new AppError('SPEC_NOT_OPENAPI');
    }

    const paths: Record<string, any> = isRecord(spec.paths) ? spec.paths : {};
    const operations = Object.entries(paths).flatMap(([path, pathItem]) =>
        httpMethodEnum.options
            .filter((method) => isRecord(pathItem) && isRecord(pathItem[method.toLowerCase()]))
            .map((method) => describeOperation(spec, path, method, pathItem[method.toLowerCase()])));

    return {
        title: typeof spec.info?.title === 'string' ? spec.info.title : null,
        oasVersion: detectOasVersion(spec),
        baseUrl: resolveBaseUrlFromSpec(spec, openApiUrl),
        operations,
    };
}
