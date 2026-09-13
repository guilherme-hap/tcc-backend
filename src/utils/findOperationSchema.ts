import { findMatchingSpecPath } from './findMatchingSpecPath.js';

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
    const operation = specPath ? spec.paths[specPath]?.[normalizedMethod] : undefined;

    if (!operation) {
        console.warn(
            `[PayloadGen] Operation ${method.toUpperCase()} ${path} not found in OpenAPI spec — skipping synthetic payload generation`,
        );
        return undefined;
    }

    // OpenAPI 3.x: requestBody.content['application/json'].schema
    const requestBody = operation.requestBody;
    if (!requestBody) {
        return undefined;
    }

    const resolvedRequestBody = requestBody.$ref
        ? resolveRef(spec, requestBody.$ref)
        : requestBody;

    if (!resolvedRequestBody) {
        return undefined;
    }

    const jsonContent =
        resolvedRequestBody.content?.['application/json'] ??
        resolvedRequestBody.content?.['*/*'];

    if (!jsonContent?.schema) {
        return undefined;
    }

    const rawSchema = jsonContent.schema;
    const resolvedSchema = rawSchema.$ref
        ? resolveRef(spec, rawSchema.$ref)
        : rawSchema;

    return resolvedSchema;
}

function resolveRef(spec: any, ref: string): any {
    if (!ref.startsWith('#/')) return undefined;

    const parts = ref.slice(2).split('/');
    let current = spec;

    for (const part of parts) {
        current = current?.[part];
        if (current === undefined) return undefined;
    }

    return current;
}
