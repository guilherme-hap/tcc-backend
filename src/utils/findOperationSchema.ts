import { findMatchingSpecPath } from './findMatchingSpecPath.js';
import { resolveRef } from './specRefs.js';

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

    const requestBody = resolveRef(spec, operation.requestBody);
    const jsonContent = requestBody?.content?.['application/json'] ?? requestBody?.content?.['*/*'];
    return resolveRef(spec, jsonContent?.schema);
}
