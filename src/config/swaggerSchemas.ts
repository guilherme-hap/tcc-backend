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
                description: 'Identificador estável do erro. Os mesmos códigos aparecem em errorCode, failedPillars[].code e performanceResults[].code no GET /api/evaluations/{id}.',
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
        },
    },
};
