import type { Severity } from '../types/severity.js';

type MessageParams = Record<string, string | number>;

interface CatalogEntry<P> {
    severity: Severity;
    message: (params: P) => string;
    recommendation?: (params: P) => string;
}

export interface IAuditMessage {
    code: AuditMessageCode;
    severity: Severity;
    message: string;
    recommendation?: string;
    params?: MessageParams;
}

const entry = <P extends MessageParams | void = void>(e: CatalogEntry<P>) => e;

const AUDIT_MESSAGES = {
    PERF_MUTATING_METHOD: entry<{ method: string }>({
        severity: 'Warning',
        message: ({ method }) => `O teste de carga usou o método ${method} contra um endpoint real.`,
        recommendation: () => 'Garanta que o ambiente alvo seja descartável (homologação/teste), e não produção.',
    }),
    PERF_SYNTHETIC_PATH_IDS: entry({
        severity: 'Info',
        message: () =>
            'Parâmetros de path sintéticos (IDs de exemplo da spec) podem ter sido usados e provavelmente não existem no alvo. ' +
            'Taxas altas de 404 são esperadas e não refletem a qualidade da API.',
        recommendation: () => 'Use um path com IDs reais do ambiente de teste.',
    }),
    PERF_SYNTHETIC_UNIQUE_FIELDS: entry({
        severity: 'Info',
        message: () =>
            'Campos excluídos da aleatorização no payload sintético (CNPJ, CPF, telefone, CEP) podem violar restrições de ' +
            'unicidade em requisições repetidas, caso a API as aplique.',
        recommendation: () => 'Informe um payload explícito se isso afetar o teste.',
    }),
    PERF_MISSING_BODY: entry({
        severity: 'Warning',
        message: () =>
            'Nenhum body foi enviado: não há payload informado nem schema requestBody (OpenAPI 3) para esta operação ' +
            '(parâmetros body do Swagger 2.0 não são suportados). Respostas de erro (ex.: 400/415) provavelmente ' +
            'refletem a ausência do body, e não a qualidade da API.',
        recommendation: () => 'Informe um payload explícito para este alvo.',
    }),
    PERF_HIGH_LOAD: entry({
        severity: 'Warning',
        message: () => 'Opção de carga alta habilitada: o teste pode gerar carga significativa contra o alvo.',
        recommendation: () => 'Garanta que você tem autorização para testar a carga desta API.',
    }),

    SEC_HSTS_MISSING: entry({
        severity: 'Warning',
        message: () => 'O header Strict-Transport-Security (HSTS) não está presente.',
        recommendation: () =>
            'Adicione o header com max-age de pelo menos 6 meses (15768000 segundos). ' +
            'Exemplo: Strict-Transport-Security: max-age=31536000; includeSubDomains.',
    }),
    SEC_HSTS_SHORT_MAX_AGE: entry<{ maxAge: number }>({
        severity: 'Info',
        message: ({ maxAge }) => `HSTS presente, mas max-age (${maxAge}s) é inferior a 6 meses (15768000s).`,
        recommendation: () => 'Aumente o max-age para pelo menos 15768000 (6 meses), idealmente 31536000 (1 ano).',
    }),
    SEC_HSTS_OK: entry({
        severity: 'Info',
        message: () => 'HSTS configurado corretamente.',
    }),
    SEC_CSP_MISSING: entry({
        severity: 'Info',
        message: () => 'O header Content-Security-Policy (CSP) não está presente.',
        recommendation: () => "Defina uma política CSP restritiva. Para APIs, ao menos: default-src 'none'.",
    }),
    SEC_CSP_WEAK_DIRECTIVES: entry<{ directives: string }>({
        severity: 'Warning',
        message: ({ directives }) => `CSP presente, mas contém diretivas fracas: ${directives}.`,
        recommendation: () => 'Remova unsafe-inline e substitua * por origens explícitas.',
    }),
    SEC_CSP_OK: entry({
        severity: 'Info',
        message: () => 'CSP configurado sem diretivas inseguras detectadas.',
    }),
    SEC_XCTO_MISSING: entry({
        severity: 'Warning',
        message: () => 'O header X-Content-Type-Options não está presente.',
        recommendation: () => 'Adicione o header com o valor "nosniff" para prevenir MIME-type sniffing.',
    }),
    SEC_XCTO_INVALID: entry<{ value: string }>({
        severity: 'Warning',
        message: ({ value }) => `X-Content-Type-Options presente com valor inesperado: "${value}".`,
        recommendation: () => 'O único valor válido é "nosniff". Corrija o header.',
    }),
    SEC_XCTO_OK: entry({
        severity: 'Info',
        message: () => 'X-Content-Type-Options configurado como "nosniff".',
    }),
    SEC_CORS_NOT_CONFIGURED: entry({
        severity: 'Info',
        message: () => 'Header Access-Control-Allow-Origin ausente (nenhum CORS configurado — seguro por padrão).',
    }),
    SEC_CORS_WILDCARD_WITH_CREDENTIALS: entry({
        severity: 'Error',
        message: () =>
            'CORS configurado com Access-Control-Allow-Origin: * e Access-Control-Allow-Credentials: true — ' +
            'combinação insegura e inválida pela especificação.',
        recommendation: () =>
            'Nunca use wildcard (*) com credentials. Especifique origens explícitas ao habilitar credentials.',
    }),
    SEC_CORS_WILDCARD: entry({
        severity: 'Warning',
        message: () => 'CORS permite qualquer origem (Access-Control-Allow-Origin: *).',
        recommendation: () => 'Restrinja a origens específicas confiáveis quando possível.',
    }),
    SEC_CORS_EXPLICIT_ORIGIN: entry<{ origin: string }>({
        severity: 'Info',
        message: ({ origin }) => `CORS configurado com origem explícita: ${origin}.`,
    }),
    SEC_FINGERPRINT_ABSENT: entry<{ header: string }>({
        severity: 'Info',
        message: ({ header }) => `Header ${header} ausente — bom, reduz fingerprinting.`,
    }),
    SEC_FINGERPRINT_VERSION_EXPOSED: entry<{ header: string; value: string }>({
        severity: 'Warning',
        message: ({ header, value }) => `Header ${header} expõe informação de versão: "${value}".`,
        recommendation: ({ header }) => `Remova ou oculte o header ${header} para reduzir a superfície de ataque.`,
    }),
    SEC_FINGERPRINT_PRESENT: entry<{ header: string; value: string }>({
        severity: 'Info',
        message: ({ header, value }) => `Header ${header} presente ("${value}"), mas sem versão detalhada.`,
        recommendation: ({ header }) => `Considere remover o header ${header} para reduzir fingerprinting.`,
    }),
};

export type AuditMessageCode = keyof typeof AUDIT_MESSAGES;

type ParamsOf<C extends AuditMessageCode> = (typeof AUDIT_MESSAGES)[C] extends CatalogEntry<infer P> ? P : never;

export function auditMessage<C extends AuditMessageCode>(
    code: C,
    ...[params]: ParamsOf<C> extends void ? [] : [ParamsOf<C>]
): IAuditMessage {
    const definition = AUDIT_MESSAGES[code] as CatalogEntry<ParamsOf<C>>;
    const p = params as ParamsOf<C>;
    const recommendation = definition.recommendation?.(p);

    return {
        code,
        severity: definition.severity,
        message: definition.message(p),
        ...(recommendation && { recommendation }),
        ...(params && { params: params as MessageParams }),
    };
}
