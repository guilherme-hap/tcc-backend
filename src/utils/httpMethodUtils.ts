import type { z } from 'zod';

const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

const TEMPLATED_PATH = /\{[^}]+\}/;

export function isMutatingMethod(method?: string): boolean {
    if (!method) return false;
    return MUTATING_METHODS.includes(method.toUpperCase() as typeof MUTATING_METHODS[number]);
}

function mutatingMethodMessage(method: string): string {
    return `O teste de carga com o método ${method} exige autorização explícita para métodos que alteram dados ` +
        `(allowMutatingMethods), pois pode criar ou apagar dados reais na API alvo.`;
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
                    `Testes de carga com DELETE exigem um path já resolvido ` +
                    `(ex.: "/pet/123" em vez de "/pet/{petId}"). ` +
                    `Parâmetros de path sintéticos não são gerados para DELETE, ` +
                    `para evitar a exclusão acidental de dados reais.`,
            });
        }
    });
}
