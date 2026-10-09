import type { MessageParams } from './catalog.js';

interface ErrorEntry<P> {
    status: number;
    message: (params: P) => string;
}

export interface IErrorMessage {
    code: ErrorCode;
    status: number;
    message: string;
}

const entry = <P extends MessageParams | void = void>(e: ErrorEntry<P>) => e;

const ERROR_MESSAGES = {
    VALIDATION_FAILED: entry({
        status: 400,
        message: () => 'A requisição contém campos inválidos.',
    }),
    REQUEST_BODY_MALFORMED: entry({
        status: 400,
        message: () => 'O corpo da requisição não é um JSON válido.',
    }),
    REQUEST_BODY_TOO_LARGE: entry({
        status: 413,
        message: () => 'O corpo da requisição excede o tamanho máximo permitido.',
    }),
    ROUTE_NOT_FOUND: entry({
        status: 404,
        message: () => 'Rota não encontrada.',
    }),
    AUTH_REQUIRED: entry({
        status: 401,
        message: () => 'Autenticação obrigatória.',
    }),
    AUTH_INVALID_TOKEN: entry({
        status: 401,
        message: () => 'Token inválido ou expirado.',
    }),
    AUTH_INVALID_CREDENTIALS: entry({
        status: 401,
        message: () => 'Credenciais inválidas.',
    }),
    AUTH_EMAIL_IN_USE: entry({
        status: 409,
        message: () => 'Este e-mail já está em uso.',
    }),
    EVALUATION_NOT_FOUND: entry({
        status: 404,
        message: () => 'Avaliação não encontrada.',
    }),
    SAVED_API_NOT_FOUND: entry({
        status: 404,
        message: () => 'API salva não encontrada.',
    }),
    CUSTOM_RULE_NOT_FOUND: entry({
        status: 404,
        message: () => 'Regra customizada não encontrada.',
    }),
    EVALUATION_ENQUEUE_FAILED: entry({
        status: 500,
        message: () => 'Não foi possível enfileirar a avaliação. Tente novamente mais tarde.',
    }),
    INTERNAL_ERROR: entry({
        status: 500,
        message: () => 'Erro interno do servidor.',
    }),

    SPEC_FETCH_FAILED: entry<{ reason: string }>({
        status: 400,
        message: ({ reason }) => `Não foi possível baixar a especificação OpenAPI (${reason}).`,
    }),
    SPEC_PARSE_FAILED: entry<{ detail: string }>({
        status: 400,
        message: ({ detail }) => `A especificação OpenAPI não é um JSON nem um YAML válido (YAML: ${detail}).`,
    }),
    SPEC_INVALID_ROOT: entry<{ received: string }>({
        status: 400,
        message: ({ received }) =>
            `A especificação OpenAPI deve ter um objeto na raiz (recebido: ${received}). ` +
            'Confira se a URL informada aponta para o arquivo da especificação.',
    }),
    SECURITY_TARGET_UNREACHABLE: entry<{ detail: string }>({
        status: 502,
        message: ({ detail }) => `Não foi possível acessar o alvo da auditoria de segurança (${detail}).`,
    }),
    SECURITY_CORS_PROBE_FAILED: entry<{ attempts: number; detail: string }>({
        status: 502,
        message: ({ attempts, detail }) => `A sonda de CORS falhou após ${attempts} tentativas (${detail}).`,
    }),
    LOAD_TEST_MUTATING_NOT_ALLOWED: entry<{ method: string }>({
        status: 400,
        message: ({ method }) =>
            `O teste de carga com o método ${method} exige autorização explícita para métodos que alteram dados (allowMutatingMethods).`,
    }),
    LOAD_TEST_FAILED: entry<{ detail: string }>({
        status: 502,
        message: ({ detail }) => `O teste de carga não pôde ser executado (${detail}).`,
    }),
    PERFORMANCE_NO_TARGET_MEASURED: entry<{ details: string }>({
        status: 502,
        message: ({ details }) => `Nenhum alvo de performance foi medido: ${details}`,
    }),
    EVALUATION_PILLARS_FAILED: entry<{ details: string }>({
        status: 502,
        message: ({ details }) => `Nenhum pilar foi concluído. ${details}`,
    }),
    EXECUTION_FAILED: entry({
        status: 500,
        message: () => 'Erro inesperado durante a execução.',
    }),
};

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const ERROR_CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[];

type ParamsOf<C extends ErrorCode> = (typeof ERROR_MESSAGES)[C] extends ErrorEntry<infer P> ? P : never;

export type ErrorMessageArgs = {
    [C in ErrorCode]: ParamsOf<C> extends void ? [code: C] : [code: C, params: ParamsOf<C>];
}[ErrorCode];

export function errorMessage(...[code, params]: ErrorMessageArgs): IErrorMessage {
    const definition = ERROR_MESSAGES[code] as ErrorEntry<MessageParams | void>;

    return {
        code,
        status: definition.status,
        message: definition.message(params),
    };
}
