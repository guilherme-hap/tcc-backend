import { findMatchingSpecPath } from './findMatchingSpecPath.js';
import { resolveRef } from './specRefs.js';

function listParameters(spec: any, owner: any): any[] {
    return Array.isArray(owner?.parameters) ? owner.parameters.map((parameter: any) => resolveRef(spec, parameter)) : [];
}

export function findRequestBodySchema(
    spec: any,
    path: string,
    method: string,
): any | undefined {
    if (!spec?.paths) {
        return undefined;
    }

    const normalizedMethod = method.toLowerCase();

    const specPath = findMatchingSpecPath(path, spec);
    const pathItem = specPath ? spec.paths[specPath] : undefined;
    const operation = pathItem?.[normalizedMethod];

    if (!operation) {
        console.warn(
            `[PayloadGen] Operation ${method} ${path} not found in OpenAPI spec — skipping synthetic payload generation`,
        );
        return undefined;
    }

    const requestBody = resolveRef(spec, operation.requestBody);
    if (requestBody) {
        const jsonContent = requestBody.content?.['application/json'] ?? requestBody.content?.['*/*'];
        return resolveRef(spec, jsonContent?.schema);
    }

    const bodyParameter = [...listParameters(spec, operation), ...listParameters(spec, pathItem)]
        .find((parameter) => parameter?.in === 'body');
    return resolveRef(spec, bodyParameter?.schema);
}
