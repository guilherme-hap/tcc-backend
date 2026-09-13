import { AppError } from '../errors/AppError.js';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function isMutatingMethod(method?: string): boolean {
    if (!method) return false;
    return MUTATING_METHODS.includes(method.toUpperCase() as typeof MUTATING_METHODS[number]);
}

export function validateLoadTestMethod(opts: {
    targetMethod?: string;
    targetPath: string;
    loadTestMethod?: string;
    allowMutatingMethods?: boolean;
}): string | undefined {
    const effectiveMethod = (
        opts.targetMethod || opts.loadTestMethod
    )?.toUpperCase();

    if (isMutatingMethod(effectiveMethod) && !opts.allowMutatingMethods) {
        throw new AppError(
            `Load test for mutating method ${effectiveMethod} requires explicit opt-in ` +
            `via allowMutatingMethods=true in loadTestOptions. ` +
            `This may create or delete real data on the target API.`,
            400,
        );
    }

    if (effectiveMethod === 'DELETE' && /\{[^}]+\}/.test(opts.targetPath)) {
        throw new AppError(
            `DELETE load tests require a fully resolved targetPath ` +
            `(e.g., "/pet/123" instead of "/pet/{petId}"). ` +
            `Synthetic path parameter generation is disabled for DELETE ` +
            `to prevent accidental deletion of real data.`,
            400,
        );
    }

    return effectiveMethod;
}
