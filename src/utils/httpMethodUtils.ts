import type { z } from 'zod';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

const TEMPLATED_PATH = /\{[^}]+\}/;

export function isMutatingMethod(method?: string): boolean {
    if (!method) return false;
    return MUTATING_METHODS.includes(method.toUpperCase() as typeof MUTATING_METHODS[number]);
}

function mutatingMethodMessage(method: string): string {
    return `Load test for mutating method ${method} requires explicit opt-in ` +
        `via allowMutatingMethods=true in loadTestOptions. ` +
        `This may create or delete real data on the target API.`;
}

export function validateTargetMethods(
    data: {
        targets: { path: string; method?: string }[];
        loadTestOptions?: { method?: string; allowMutatingMethods?: boolean };
    },
    ctx: z.RefinementCtx,
): void {
    const defaultMethod = data.loadTestOptions?.method;
    const allowMutatingMethods = data.loadTestOptions?.allowMutatingMethods;

    if (defaultMethod && isMutatingMethod(defaultMethod) && !allowMutatingMethods && data.targets.some((t) => !t.method)) {
        ctx.addIssue({ code: 'custom', path: ['loadTestOptions', 'method'], message: mutatingMethodMessage(defaultMethod) });
    }

    data.targets.forEach((target, index) => {
        if (target.method && isMutatingMethod(target.method) && !allowMutatingMethods) {
            ctx.addIssue({ code: 'custom', path: ['targets', index, 'method'], message: mutatingMethodMessage(target.method) });
        }

        if ((target.method ?? defaultMethod) === 'DELETE' && TEMPLATED_PATH.test(target.path)) {
            ctx.addIssue({
                code: 'custom',
                path: ['targets', index, 'path'],
                message:
                    `DELETE load tests require a fully resolved path ` +
                    `(e.g., "/pet/123" instead of "/pet/{petId}"). ` +
                    `Synthetic path parameter generation is disabled for DELETE ` +
                    `to prevent accidental deletion of real data.`,
            });
        }
    });
}
