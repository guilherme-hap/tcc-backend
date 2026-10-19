import { ERROR_CODES } from '../messages/errors.js';

const severityWeight = { type: 'number', minimum: 0, maximum: 1000 };

export const SWAGGER_SCHEMAS = {
    ErrorResponse: {
        type: 'object',
        required: ['error', 'code'],
        properties: {
            error: {
                type: 'string',
                description: 'Mensagem em português, pronta para exibição.',
                example: 'A requisição contém campos inválidos.',
            },
            code: {
                type: 'string',
                enum: ERROR_CODES,
                description: 'Identificador estável do erro. Os mesmos códigos aparecem em errorCode, steps[].code e performanceResults[].code no GET /api/evaluations/{id}.',
                example: 'VALIDATION_FAILED',
            },
            issues: {
                type: 'array',
                description: 'Presente só quando code = VALIDATION_FAILED: um item por campo inválido.',
                items: {
                    type: 'object',
                    required: ['path', 'message'],
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Caminho do campo no corpo da requisição, com pontos (vazio quando o erro é do corpo inteiro).',
                            example: 'targets.0.path',
                        },
                        message: {
                            type: 'string',
                            example: 'Informe o path do alvo',
                        },
                    },
                },
            },
        },
    },
    RulesConfig: {
        type: 'object',
        description: 'Liga (true) ou desliga (false) regras do Spectral; as omitidas ficam no estado padrão. Os nomes válidos e o estado padrão de cada regra estão em GET /api/rules; nome fora do catálogo é rejeitado com 400.',
        additionalProperties: { type: 'boolean' },
        example: { 'operation-tags': true },
    },
    SeverityWeights: {
        type: 'object',
        description: 'Pesos por severidade usados na nota do contrato. Chaves válidas: Error, Warning, Info, Hint, Unknown; valores numéricos de 0 a 1000 (só a proporção entre eles importa). Cada chave informada sobrescreve o peso padrão correspondente; as omitidas usam o padrão: Error 0.5208, Warning 0.2708, Info 0.1458, Hint 0.0625, Unknown 0.',
        properties: {
            Error: severityWeight,
            Warning: severityWeight,
            Info: severityWeight,
            Hint: severityWeight,
            Unknown: severityWeight,
        },
        additionalProperties: false,
        example: { Error: 0.6, Warning: 0.3, Info: 0.1 },
    },
    PerformanceTarget: {
        type: 'object',
        required: ['path'],
        properties: {
            path: {
                type: 'string',
                description: 'Rota específica da API a ser testada pelo Autocannon.',
                example: '/pet/findByStatus',
            },
            method: {
                type: 'string',
                description: 'Método HTTP a ser utilizado pelo teste de carga.',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                example: 'GET',
            },
            payload: {
                description: 'Corpo (payload) da requisição para testes de estresse em métodos como POST ou PUT.',
                example: { status: 'available' },
            },
            pathParams: {
                type: 'object',
                description: 'Valores dos parâmetros {nome} do path, por nome (texto ou número). Os informados substituem os valores sintéticos gerados a partir da especificação. Em DELETE é obrigatório informar todos os parâmetros do path, pois valores sintéticos não são gerados. Chave que não corresponde a um parâmetro do path é rejeitada com 400.',
                additionalProperties: { type: 'string' },
                example: { petId: '123' },
            },
        },
    },
    EvaluationStep: {
        type: 'object',
        required: ['pillar', 'stage', 'status', 'startedAt', 'finishedAt'],
        description: 'Uma etapa da avaliação: um pilar. Etapas com o mesmo stage rodam em paralelo; stages diferentes rodam em sequência (no full: 0 = contrato e segurança, 1 = performance).',
        properties: {
            pillar: {
                type: 'string',
                enum: ['contract', 'performance', 'security'],
            },
            stage: {
                type: 'integer',
                example: 0,
            },
            status: {
                type: 'string',
                enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'INTERRUPTED'],
                description: 'PENDING: ainda não começou. RUNNING: em execução. COMPLETED: concluída, com nota em pillarScores. FAILED: falhou (ver error e code). SKIPPED: pulada por uma pré-condição (ver error e code). INTERRUPTED: a avaliação terminou antes desta etapa terminar (falha fora dos pilares ou execução interrompida); só aparece em avaliação finalizada.',
            },
            startedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            finishedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
            },
            error: {
                type: 'string',
                description: 'Presente em FAILED e SKIPPED: motivo em português. Detalhes vindos da rede ou de bibliotecas (ex.: ECONNREFUSED) aparecem entre parênteses, como recebidos.',
            },
            code: {
                type: 'string',
                description: 'Presente junto com error: código de erro (ex.: SPEC_FETCH_FAILED, SECURITY_TARGET_UNREACHABLE, PERFORMANCE_NO_TARGET_MEASURED) ou, em SKIPPED, código de auditoria (PERF_SKIPPED_INVALID_SPEC).',
                example: 'SPEC_FETCH_FAILED',
            },
            progress: {
                type: 'object',
                description: 'Só na etapa de performance enquanto ela está RUNNING: o alvo em andamento. Atualizado a cada segundo durante o teste de carga.',
                properties: {
                    targetIndex: {
                        type: 'integer',
                        description: 'Índice do alvo em targets, a partir de 0.',
                    },
                    totalTargets: {
                        type: 'integer',
                    },
                    run: {
                        type: 'integer',
                        description: 'Execução em andamento do teste de carga, a partir de 1.',
                    },
                    totalRuns: {
                        type: 'integer',
                        description: 'Total de execuções configuradas (loadTestOptions.repetitions).',
                    },
                    phase: {
                        type: 'string',
                        enum: ['QUEUED', 'RUNNING', 'RESTING'],
                        description: 'QUEUED: aguardando a vez, porque o auditor roda um teste de carga por vez em todo o sistema (e nenhuma análise de contrato ou segurança durante a carga). RUNNING: teste de carga em andamento. RESTING: intervalo entre execuções, para a API voltar ao repouso.',
                    },
                    startedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: 'Início do teste de carga do alvo; nulo em QUEUED.',
                    },
                    expectedDurationSeconds: {
                        type: 'number',
                        description: 'Duração configurada do teste do alvo. Com maxRequests o teste pode acabar antes.',
                    },
                    elapsedSeconds: {
                        type: 'integer',
                        description: 'Segundos já medidos do teste do alvo.',
                    },
                    responses: {
                        type: 'integer',
                        description: 'Respostas recebidas até agora (inclusive 4xx).',
                    },
                    errors: {
                        type: 'integer',
                        description: 'Respostas 5xx mais erros de conexão e timeouts até agora.',
                    },
                    lastSecond: {
                        type: 'object',
                        nullable: true,
                        description: 'Último segundo medido, no mesmo formato de um ponto de performanceResults[].result.series. Nulo antes do primeiro segundo.',
                        properties: {
                            second: { type: 'integer' },
                            responses: { type: 'integer' },
                            meanLatency: { type: 'number', nullable: true },
                            errors: { type: 'integer' },
                        },
                    },
                },
            },
        },
    },
    LoadTestOptions: {
        type: 'object',
        description: 'Opções adicionais e avançadas de configuração do Autocannon. Limites padrão (default): duration ≤ 60s, connections ≤ 50, maxRequests ≤ 100.000, requestsPerSecond ≤ 1.000. Com allowHighLoad=true: duration ≤ 300s, connections ≤ 500, maxRequests ≤ 1.000.000, requestsPerSecond ≤ 10.000.',
        properties: {
            duration: {
                type: 'number',
                description: 'Duração do teste em segundos (padrão máx. 60; com allowHighLoad máx. 300). Padrão 10 (5 para métodos mutantes). Precisa ser maior que 4 × targetLatency, para que um alvo que não responde seja contado como frustrado.',
                example: 10,
            },
            connections: {
                type: 'number',
                description: 'Número de conexões concorrentes simultâneas (padrão máx. 50; com allowHighLoad máx. 500).',
                example: 10,
            },
            targetLatency: {
                type: 'number',
                description: 'Latência alvo T em milissegundos para o Apdex (padrão 1000). Respostas 2xx/3xx com latência ≤ T são satisfeitas, ≤ 4T toleradas e acima disso frustradas; 5xx, timeouts e erros de conexão também são frustrados.',
                example: 1000,
            },
            maxRequests: {
                type: 'number',
                description: 'Quantidade máxima de requisições por alvo (padrão máx. 100.000; com allowHighLoad máx. 1.000.000). O teste termina ao atingir maxRequests ou duration, o que ocorrer primeiro. Não pode ser menor que connections.',
                example: 1000,
            },
            requestsPerSecond: {
                type: 'number',
                description: 'Taxa máxima de requisições por segundo (padrão máx. 1.000; com allowHighLoad máx. 10.000).',
                example: 100,
            },
            method: {
                type: 'string',
                description: 'Método HTTP padrão global para o teste de carga. É sobrescrito pelo method definido individualmente no alvo (target.method tem precedência).',
                enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                example: 'GET',
            },
            headers: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Headers HTTP customizados a serem enviados em todas as requisições do teste de carga.',
                example: { Authorization: 'Bearer token', 'X-Custom-Header': 'value' },
            },
            allowMutatingMethods: {
                type: 'boolean',
                description: 'Opt-in explícito para permitir métodos HTTP mutantes (POST, PUT, DELETE, PATCH) no teste de carga. Obrigatório quando o método for mutante.',
                default: false,
            },
            body: {
                type: 'string',
                description: 'Corpo padrão global em formato string/JSON. Aplicado exclusivamente a alvos com métodos mutantes (POST, PUT, PATCH) que não possuam payload próprio; ignorado em métodos não mutantes (GET, DELETE).',
            },
            allowHighLoad: {
                type: 'boolean',
                description: 'Opt-in explícito para elevar os tetos de duration, connections, maxRequests e requestsPerSecond ao tier elevado. Use com cautela ao testar APIs de terceiros que você não controla.',
                default: false,
            },
            mode: {
                type: 'string',
                enum: ['complete', 'quick'],
                description: 'complete (padrão): repete o teste de carga repetitions vezes. quick: executa uma única vez (uso em CI/CD); não pode ser combinado com repetitions maior que 1.',
                example: 'complete',
            },
            repetitions: {
                type: 'integer',
                minimum: 1,
                maximum: 10,
                description: 'Número de execuções do teste de carga por avaliação (padrão 3; 1 no modo quick). O Apdex é calculado por alvo em cada execução e só depois agregado pela média; as amostras nunca são juntadas entre execuções.',
                example: 3,
            },
            restIntervalSeconds: {
                type: 'number',
                minimum: 0,
                maximum: 300,
                description: 'Intervalo, em segundos, entre uma execução e a seguinte, para a API voltar ao repouso (padrão 5).',
                example: 5,
            },
            maxCpuUsage: {
                type: 'number',
                description: 'Limiar provisório de CPU do gerador de carga, em fração de um núcleo (padrão 0,8). Acima dele a execução é marcada como possível viés do cliente; a nota não é alterada.',
                example: 0.8,
            },
            maxEventLoopDelayMs: {
                type: 'number',
                description: 'Limiar provisório do atraso p99 do event loop do gerador, em ms, descontada a resolução da medição (padrão 50). Acima dele a execução é marcada como possível viés do cliente; a nota não é alterada.',
                example: 50,
            },
            stabilityThreshold: {
                type: 'number',
                description: 'Limiar provisório do coeficiente de variação da nota do pilar entre execuções (padrão 0,10). Acima dele a avaliação é marcada como de baixa estabilidade.',
                example: 0.1,
            },
        },
    },
};
