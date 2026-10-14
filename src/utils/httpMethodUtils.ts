import type { z } from 'zod';

const MUTATING_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

const PATH_PLACEHOLDER = /\{([^}]+)\}/g;

export function isMutatingMethod(method?: string): boolean {
    return method !== undefined && MUTATING_METHODS.includes(method);
}

export function acceptsRequestBody(method?: string): boolean {
    return isMutatingMethod(method) && method !== 'DELETE';
}

export function pathPlaceholders(path: string): string[] {
    return [...new Set([...path.matchAll(PATH_PLACEHOLDER)].map((match) => match[1]))];
}

function mutatingMethodMessage(method: string): string {
    return `O teste de carga com o método ${method} exige autorização explícita para métodos que alteram dados ` +
        `(allowMutatingMethods), pois pode criar ou apagar dados reais na API alvo.`;
}

export function validateTargetMethods(
    data: {
        targets: { path: string; method?: string; pathParams?: Record<string, string> }[];
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

        const placeholders = pathPlaceholders(target.path);
        const informed = Object.keys(target.pathParams ?? {});

        for (const name of informed) {
            if (!placeholders.includes(name)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['targets', index, 'pathParams', name],
                    message: `O path do alvo não tem o parâmetro {${name}}.`,
                });
            }
        }

        const missing = placeholders.filter((name) => !informed.includes(name));
        if ((target.method ?? defaultMethod) === 'DELETE' && missing.length > 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['targets', index, 'path'],
                message:
                    `Testes de carga com DELETE exigem o valor de cada parâmetro do path: informe ` +
                    `${missing.map((name) => `{${name}}`).join(', ')} em pathParams ou use um path já resolvido ` +
                    `(ex.: "/pet/123" em vez de "/pet/{petId}"). ` +
                    `Parâmetros de path sintéticos não são gerados para DELETE, ` +
                    `para evitar a exclusão acidental de dados reais.`,
            });
        }
    });
}
