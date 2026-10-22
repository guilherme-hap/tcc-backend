import type { Severity } from '../types/severity.js';

export type MessageParams = Record<string, string | number>;

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
            'Respostas 4xx (como 404) são excluídas da amostra do Apdex e não afetam a nota.',
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
            'Nenhum body foi enviado: não há payload informado nem schema de corpo JSON para esta operação na especificação ' +
            '(requestBody no OpenAPI 3, parâmetro body no Swagger 2.0). Respostas 4xx (ex.: 400/415) provavelmente ' +
            'decorrem da ausência do body e são excluídas da amostra do Apdex.',
        recommendation: () => 'Informe um payload explícito para este alvo.',
    }),
    PERF_SMALL_SAMPLE: entry<{ sampleSize: number }>({
        severity: 'Warning',
        message: ({ sampleSize }) =>
            `A amostra válida do Apdex tem apenas ${sampleSize} requisições (mínimo recomendado: 100); a nota é pouco confiável.`,
        recommendation: () => 'Aumente a duração ou o número máximo de requisições do teste.',
    }),
    PERF_EXCLUDED_4XX: entry<{ count: number }>({
        severity: 'Info',
        message: ({ count }) =>
            `${count.toLocaleString('pt-BR')} respostas 4xx foram excluídas da amostra do Apdex e não afetam a nota.`,
        recommendation: () => 'Se esperava respostas de sucesso, informe path com IDs reais e payload válido para este alvo.',
    }),
    PERF_NO_VALID_SAMPLE: entry({
        severity: 'Warning',
        message: () =>
            'Nenhuma requisição válida foi medida (todas as respostas foram 4xx ou não houve resposta); o alvo não recebeu nota.',
        recommendation: () => 'Informe path com IDs reais e payload válido para que o endpoint responda com sucesso.',
    }),
    PERF_NO_RESPONSE: entry<{ attempts: number }>({
        severity: 'Warning',
        message: ({ attempts }) =>
            `Nenhuma das ${attempts.toLocaleString('pt-BR')} requisições recebeu resposta (falha de conexão ou tempo esgotado); ` +
            'a nota 0 pode indicar um endereço incorreto, e não uma API lenta.',
        recommendation: () => 'Confira a URL base, o host e a porta do alvo, e se ele está acessível a partir do auditor.',
    }),
    PERF_HIGH_LOAD: entry({
        severity: 'Warning',
        message: () => 'Opção de carga alta habilitada: o teste pode gerar carga significativa contra o alvo.',
        recommendation: () => 'Garanta que você tem autorização para testar a carga desta API.',
    }),
    PERF_CLIENT_BIAS: entry<{ cpu: number; maxCpu: number; eventLoopDelayMs: number; maxEventLoopDelayMs: number }>({
        severity: 'Warning',
        message: ({ cpu, maxCpu, eventLoopDelayMs, maxEventLoopDelayMs }) =>
            'Possível viés do cliente: o gerador de carga pode ter saturado durante esta execução ' +
            `(CPU em ${cpu.toLocaleString('pt-BR')} de um núcleo, limite ${maxCpu.toLocaleString('pt-BR')}; ` +
            `atraso p99 do event loop de ${eventLoopDelayMs.toLocaleString('pt-BR')} ms, limite ${maxEventLoopDelayMs.toLocaleString('pt-BR')} ms). ` +
            'A nota não foi alterada.',
        recommendation: () => 'Reduza as conexões ou a taxa do teste, ou execute o gerador de carga em um host dedicado.',
    }),
    PERF_CLIENT_BIAS_RUNS: entry<{ affected: number; total: number }>({
        severity: 'Warning',
        message: ({ affected, total }) =>
            `Possível viés do cliente em ${affected} de ${total} execuções: o gerador de carga pode ter saturado e inflado a latência medida. A nota não foi alterada.`,
        recommendation: () => 'Veja a CPU e o atraso do event loop de cada execução; reduza as conexões ou use um host dedicado.',
    }),
    PERF_RUNS_EXCLUDED: entry<{ counted: number; total: number }>({
        severity: 'Warning',
        message: ({ counted, total }) =>
            `Apenas ${counted} de ${total} execuções entraram na média deste alvo; as demais não tiveram requisição válida.`,
        recommendation: () => 'Informe path com IDs reais e payload válido para que todas as execuções respondam com sucesso.',
    }),
    PERF_LOW_STABILITY: entry<{ coefficientOfVariation: number; threshold: number; runs: number }>({
        severity: 'Warning',
        message: ({ coefficientOfVariation, threshold, runs }) =>
            `Baixa estabilidade: a nota do pilar variou entre as ${runs} execuções (coeficiente de variação ${coefficientOfVariation.toLocaleString('pt-BR')}, ` +
            `limite ${threshold.toLocaleString('pt-BR')}). O resultado é pouco reprodutível.`,
        recommendation: () => 'Avalie novamente, aumente a duração ou o intervalo entre execuções, ou verifique se o ambiente alvo é compartilhado.',
    }),
    PERF_STABILITY_NOT_MEASURED: entry({
        severity: 'Info',
        message: () => 'A estabilidade não foi medida: o teste de carga rodou uma única vez (ou só uma execução teve amostra válida).',
        recommendation: () => 'Use o modo completo (3 execuções, por padrão) para medir a dispersão entre execuções.',
    }),
    PERF_SAME_MACHINE: entry<{ host: string }>({
        severity: 'Warning',
        message: ({ host }) =>
            `O gerador de carga e a API avaliada (${host}) compartilham a mesma máquina: os dois disputam CPU e rede, e a latência medida pode ser afetada.`,
        recommendation: () => 'Para uma medição isolada, execute o gerador de carga em outro host (worker de carga externo).',
    }),
    PERF_SAME_MACHINE_UNVERIFIED: entry<{ host: string }>({
        severity: 'Info',
        message: ({ host }) =>
            `Não foi possível verificar se o gerador de carga e a API avaliada compartilham a máquina: o endereço de ${host} não foi resolvido.`,
    }),
    PERF_SAME_MACHINE_CONTAINER_UNVERIFIED: entry<{ host: string; address: string }>({
        severity: 'Info',
        message: ({ host, address }) =>
            `O gerador de carga roda em container e ${host} resolve para um endereço de rede privada (${address}): a API pode estar na mesma máquina (no host ou em outro container), e isso não pôde ser verificado.`,
        recommendation: () => 'Para uma medição isolada, avalie a API em outra máquina (ex.: ambiente de homologação).',
    }),
    PERF_SKIPPED_INVALID_SPEC: entry<{ rule: string }>({
        severity: 'Error',
        message: ({ rule }) =>
            `O teste de carga não foi executado: a especificação tem erro estrutural (${rule}), ` +
            'e ela é usada para montar as URLs e os payloads do teste.',
        recommendation: () => 'Corrija os erros de estrutura apontados no pilar de contrato e avalie novamente.',
    }),

    SEC_TRANSPORT_HTTPS_OK: entry({
        severity: 'Info',
        message: () => 'O alvo é acessado via HTTPS.',
    }),
    SEC_TRANSPORT_NOT_HTTPS: entry({
        severity: 'Error',
        message: () => 'O alvo foi informado com http://: o tráfego da API, incluindo credenciais, trafega sem criptografia.',
        recommendation: () => 'Sirva a API por HTTPS e informe a URL base com https://.',
    }),
    SEC_TRANSPORT_NOT_HTTPS_LOCAL: entry<{ host: string }>({
        severity: 'Error',
        message: ({ host }) =>
            `O alvo foi informado com http:// em um endereço local (${host}): o tráfego trafega sem criptografia. ` +
            'O resultado da camada de transporte reflete o ambiente de desenvolvimento, não a API publicada; a nota não é ajustada.',
        recommendation: () => 'Para avaliar o transporte, informe a URL base em https:// do ambiente publicado.',
    }),
    SEC_TRANSPORT_REDIRECT_OK: entry({
        severity: 'Info',
        message: () => 'A versão http:// do alvo redireciona para https://.',
    }),
    SEC_TRANSPORT_HTTP_REFUSED: entry({
        severity: 'Info',
        message: () => 'A versão http:// do alvo não atende requisições HTTP em texto puro (conexão recusada ou requisição rejeitada).',
    }),
    SEC_TRANSPORT_HTTP_TIMEOUT: entry({
        severity: 'Info',
        message: () =>
            'A versão http:// do alvo não aceitou a conexão dentro do tempo limite (porta provavelmente filtrada); ' +
            'tratada como não exposta em texto puro.',
    }),
    SEC_TRANSPORT_HTTP_NO_RESPONSE: entry({
        severity: 'Warning',
        message: () =>
            'A versão http:// do alvo aceitou a conexão em texto puro, mas não respondeu dentro do tempo limite; ' +
            'não foi possível confirmar o redirecionamento para HTTPS.',
        recommendation: () =>
            'Redirecione requisições HTTP para HTTPS ou feche a porta HTTP, para que o servidor não aceite tráfego em texto puro.',
    }),
    SEC_TRANSPORT_REDIRECT_NOT_HTTPS: entry<{ status: number; location: string }>({
        severity: 'Error',
        message: ({ status, location }) =>
            `A versão http:// do alvo responde ${status}, mas o redirecionamento não aponta para https:// (Location: ${location}).`,
        recommendation: () => 'Redirecione toda requisição HTTP para a URL equivalente em https:// (301 ou 308).',
    }),
    SEC_TRANSPORT_HTTP_SERVED: entry<{ status: number }>({
        severity: 'Error',
        message: ({ status }) => `A versão http:// do alvo responde ${status} em texto puro, sem redirecionar para HTTPS.`,
        recommendation: () =>
            'Redirecione requisições HTTP para HTTPS ou desative o atendimento na porta HTTP. ' +
            'Combine com HSTS para que os clientes passem a usar HTTPS diretamente.',
    }),
    SEC_HSTS_REQUIRES_HTTPS: entry({
        severity: 'Warning',
        message: () => 'HSTS não se aplica: a resposta analisada não foi recebida por HTTPS, e navegadores ignoram o header em HTTP.',
        recommendation: () => 'Sirva a API por HTTPS e envie Strict-Transport-Security nas respostas HTTPS.',
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
    SEC_FRAMING_MISSING: entry({
        severity: 'Warning',
        message: () =>
            'Nenhuma proteção contra incorporação em frames: a diretiva frame-ancestors da Content-Security-Policy ' +
            'e o header X-Frame-Options estão ausentes.',
        recommendation: () =>
            "Adicione Content-Security-Policy: frame-ancestors 'none' (ou X-Frame-Options: DENY). " +
            'Em APIs JSON, essa é a única parte da CSP que se aplica.',
    }),
    SEC_FRAMING_WEAK: entry<{ source: string; value: string }>({
        severity: 'Warning',
        message: ({ source, value }) => `A proteção contra frames em ${source} é permissiva ou inválida: "${value}".`,
        recommendation: () =>
            "Use frame-ancestors 'none' ou 'self' na CSP, ou X-Frame-Options: DENY ou SAMEORIGIN (ALLOW-FROM é obsoleto).",
    }),
    SEC_FRAMING_OK: entry<{ source: string; value: string }>({
        severity: 'Info',
        message: ({ source, value }) => `Proteção contra frames configurada via ${source}: "${value}".`,
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
        message: () =>
            'Uma origem não autorizada não recebeu Access-Control-Allow-Origin (CORS ausente ou restrito — seguro por padrão).',
    }),
    SEC_CORS_PROBE_UNANSWERED: entry<{ attempts: number; detail: string }>({
        severity: 'Warning',
        message: ({ attempts, detail }) =>
            `A sonda com uma origem não autorizada não obteve resposta após ${attempts} tentativas (${detail}). ` +
            'Na requisição sem Origin o servidor não enviou Access-Control-Allow-Origin, então o comportamento para ' +
            'origens externas não foi verificado.',
        recommendation: () =>
            'Confira se um firewall ou proxy derruba conexões com cabeçalho Origin desconhecido e, se for o caso, ' +
            'responda 403 em vez de cortar a conexão.',
    }),
    SEC_CORS_REFLECTED_ORIGIN: entry<{ origin: string }>({
        severity: 'Error',
        message: ({ origin }) =>
            `O servidor refletiu a origem arbitrária ${origin} em Access-Control-Allow-Origin e enviou ` +
            'Access-Control-Allow-Credentials: true: qualquer site pode ler respostas autenticadas.',
        recommendation: () =>
            'Valide a origem contra uma lista fixa de origens confiáveis antes de refleti-la, principalmente com credentials.',
    }),
    SEC_CORS_NULL_ORIGIN_WITH_CREDENTIALS: entry({
        severity: 'Error',
        message: () =>
            'CORS responde Access-Control-Allow-Origin: null com Access-Control-Allow-Credentials: true: ' +
            'páginas em sandbox ou arquivos locais conseguem ler respostas autenticadas.',
        recommendation: () => 'Não autorize a origem "null"; use uma lista fixa de origens confiáveis.',
    }),
    SEC_CORS_WILDCARD_WITH_CREDENTIALS: entry({
        severity: 'Warning',
        message: () =>
            'CORS configurado com Access-Control-Allow-Origin: * e Access-Control-Allow-Credentials: true — ' +
            'combinação inválida pela especificação (navegadores a bloqueiam), mas indica configuração incorreta.',
        recommendation: () =>
            'Nunca use wildcard (*) com credentials. Especifique origens explícitas ao habilitar credentials.',
    }),
    SEC_CORS_WILDCARD: entry({
        severity: 'Info',
        message: () =>
            'CORS permite qualquer origem sem credenciais (Access-Control-Allow-Origin: *), ' +
            'comum e aceitável em APIs públicas.',
    }),
    SEC_CORS_REFLECTED_ORIGIN_NO_CREDENTIALS: entry<{ origin: string }>({
        severity: 'Info',
        message: ({ origin }) =>
            `O servidor refletiu a origem arbitrária ${origin} em Access-Control-Allow-Origin, sem credenciais: ` +
            'equivale a permitir qualquer origem sem credenciais.',
        recommendation: () => 'Se a API passar a usar cookies ou credenciais, restrinja as origens a uma lista fixa.',
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
