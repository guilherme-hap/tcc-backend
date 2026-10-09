import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { validate } from '../middlewares/validate.js';
import { validateIdParam } from '../middlewares/validateIdParam.js';
import {
    contractRequestSchema,
    performanceRequestSchema,
    securityRequestSchema,
    fullEvaluationRequestSchema,
} from '../schemas/evaluation.schema.js';

const router = Router();
const evaluationController = new EvaluationController();

/**
 * @openapi
 * tags:
 *   - name: Evaluation
 *     description: "Endpoints responsáveis pelo disparo e consulta de auditorias de contrato OpenAPI e testes de performance."
 *
 * /api/evaluations/contract:
 *   post:
 *     summary: "Executa o linting de conformidade do contrato OpenAPI"
 *     description: "Baixa o arquivo OpenAPI (JSON/YAML) diretamente da URL informada e valida as regras oficiais do Spectral sobre a especificação completa. A nota (0-100) é a razão de conformidade por regra: 100 × (1 − peso das regras violadas / peso das regras aplicáveis, isto é, ativas, do formato da especificação e com ao menos um alvo no documento); uma regra violada conta uma vez, independentemente do número de ocorrências. Pesos padrão por severidade: Error 0.5208, Warning 0.2708, Info 0.1458, Hint 0.0625, Unknown 0. O processo é enfileirado de forma assíncrona. Use GET /api/evaluations/{id} para acompanhar o resultado."
 *     tags: [Evaluation]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openApiUrl
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               rulesConfig:
 *                 type: object
 *                 description: "Configuração opcional de regras customizadas para o Spectral."
 *                 example: { "operation-tags": true }
 *     responses:
 *       202:
 *         description: "Avaliação enfileirada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   format: uuid
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ausente ou sem protocolo http/https, rulesConfig com valor não booleano, severityWeights negativo)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/evaluations/performance:
 *   post:
 *     summary: "Executa teste de carga/performance em endpoints alvos"
 *     description: "Realiza teste de estresse utilizando o Autocannon sequencialmente nos endpoints informados em targets. Caso apiBaseUrl não seja fornecida, a URL base será resolvida automaticamente a partir da especificação OpenAPI informada em openApiUrl."
 *     tags: [Evaluation]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openApiUrl
 *               - targets
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL raiz opcional para sobrescrever o servidor da API. Caso omitida, será resolvida automaticamente do contrato OpenAPI."
 *                 example: "https://petstore.swagger.io/v2"
 *               targets:
 *                 type: array
 *                 description: "Lista de endpoints alvos a serem testados sequencialmente pelo Autocannon (mínimo 1, máximo 20). A soma das durações dos testes (targets.length * duration) não pode exceder 600 segundos."
 *                 minItems: 1
 *                 maxItems: 20
 *                 items:
 *                   type: object
 *                   required:
 *                     - path
 *                   properties:
 *                     path:
 *                       type: string
 *                       description: "Rota específica da API a ser testada pelo Autocannon."
 *                       example: "/pet/findByStatus"
 *                     method:
 *                       type: string
 *                       description: "Método HTTP a ser utilizado pelo teste de carga."
 *                       enum: [GET, POST, PUT, DELETE, PATCH]
 *                       example: "GET"
 *                     payload:
 *                       description: "Corpo (payload) da requisição para testes de estresse em métodos como POST ou PUT."
 *                       example: { "status": "available" }
 *                 example:
 *                   - path: "/pet/findByStatus"
 *                     method: "GET"
 *                   - path: "/pet"
 *                     method: "POST"
 *                     payload: { "name": "doggie", "photoUrls": [] }
 *               loadTestOptions:
 *                 type: object
 *                 description: "Opções adicionais e avançadas de configuração do Autocannon. Limites padrão (default): duration ≤ 60s, connections ≤ 50, maxRequests ≤ 100.000, requestsPerSecond ≤ 1.000. Com allowHighLoad=true: duration ≤ 300s, connections ≤ 500, maxRequests ≤ 1.000.000, requestsPerSecond ≤ 10.000."
 *                 properties:
 *                   duration:
 *                     type: number
 *                     description: "Duração do teste em segundos (padrão máx. 60; com allowHighLoad máx. 300). Padrão 10 (5 para métodos mutantes). Precisa ser maior que 4 × targetLatency, para que um alvo que não responde seja contado como frustrado."
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     description: "Número de conexões concorrentes simultâneas (padrão máx. 50; com allowHighLoad máx. 500)."
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     description: "Latência alvo T em milissegundos para o Apdex (padrão 1000). Respostas 2xx/3xx com latência ≤ T são satisfeitas, ≤ 4T toleradas e acima disso frustradas; 5xx, timeouts e erros de conexão também são frustrados."
 *                     example: 1000
 *                   maxRequests:
 *                     type: number
 *                     description: "Quantidade máxima de requisições por alvo (padrão máx. 100.000; com allowHighLoad máx. 1.000.000). O teste termina ao atingir maxRequests ou duration, o que ocorrer primeiro. Não pode ser menor que connections."
 *                     example: 1000
 *                   requestsPerSecond:
 *                     type: number
 *                     description: "Taxa máxima de requisições por segundo (padrão máx. 1.000; com allowHighLoad máx. 10.000)."
 *                     example: 100
 *                   method:
 *                     type: string
 *                     description: "Método HTTP padrão global para o teste de carga. É sobrescrito pelo method definido individualmente no alvo (target.method tem precedência)."
 *                     enum: [GET, POST, PUT, DELETE, PATCH]
 *                     example: "GET"
 *                   headers:
 *                     type: object
 *                     additionalProperties:
 *                       type: string
 *                     description: "Headers HTTP customizados a serem enviados em todas as requisições do teste de carga."
 *                     example: { "Authorization": "Bearer token", "X-Custom-Header": "value" }
 *                   allowMutatingMethods:
 *                     type: boolean
 *                     description: "Opt-in explícito para permitir métodos HTTP mutantes (POST, PUT, DELETE, PATCH) no teste de carga. Obrigatório quando o método for mutante."
 *                     default: false
 *                   body:
 *                     type: string
 *                     description: "Corpo padrão global em formato string/JSON. Aplicado exclusivamente a alvos com métodos mutantes (POST, PUT, PATCH) que não possuam payload próprio; ignorado em métodos não mutantes (GET, DELETE)."
 *                   allowHighLoad:
 *                     type: boolean
 *                     description: "Opt-in explícito para elevar os tetos de duration, connections, maxRequests e requestsPerSecond ao tier elevado. Use com cautela ao testar APIs de terceiros que você não controla."
 *                     default: false
 *     responses:
 *       202:
 *         description: "Avaliação enfileirada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   format: uuid
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ou targets ausentes, path vazio, método inválido, método mutante sem allowMutatingMethods, DELETE com path parametrizado ou limite de duração total excedido)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/evaluations/full:
 *   post:
 *     summary: "Executa avaliação completa (Contrato global + Performance pontual + Segurança dos headers)"
 *     description: "Executa o linting do Spectral sobre toda a especificação OpenAPI informada em openApiUrl, o teste de carga com Autocannon sequencialmente nas rotas indicadas em targets e a auditoria de segurança dos headers HTTP do servidor. Contrato e segurança rodam primeiro; o teste de carga roda depois, sozinho. Se o contrato apontar erro estrutural na especificação (oas2-schema, oas3-schema ou parser com severidade Error, ou documento não reconhecido como OpenAPI, unrecognized-format), o teste de carga não é executado e a avaliação termina como PARTIAL, com failedPillars indicando o código PERF_SKIPPED_INVALID_SPEC. Ao final, pondera as notas individuais dos 3 pilares calculando o score global; em PARTIAL a nota final é nula e pillarScores traz as notas dos pilares que rodaram."
 *     tags: [Evaluation]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openApiUrl
 *               - targets
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL raiz opcional para sobrescrever o servidor da API. Caso omitida, será resolvida automaticamente do contrato OpenAPI."
 *                 example: "https://petstore.swagger.io/v2"
 *               targets:
 *                 type: array
 *                 description: "Lista de endpoints alvos a serem testados pelo Autocannon (mínimo 1, máximo 20). A soma das durações dos testes (targets.length * duration) não pode exceder 600 segundos."
 *                 minItems: 1
 *                 maxItems: 20
 *                 items:
 *                   type: object
 *                   required:
 *                     - path
 *                   properties:
 *                     path:
 *                       type: string
 *                       description: "Rota específica da API a ser testada pelo Autocannon."
 *                       example: "/pet/findByStatus"
 *                     method:
 *                       type: string
 *                       description: "Método HTTP para o teste de carga."
 *                       enum: [GET, POST, PUT, DELETE, PATCH]
 *                       example: "GET"
 *                     payload:
 *                       description: "Corpo (payload) da requisição para testes de estresse em métodos como POST ou PUT."
 *                       example: { "status": "available" }
 *                 example:
 *                   - path: "/pet/findByStatus"
 *                     method: "GET"
 *                   - path: "/pet"
 *                     method: "POST"
 *                     payload: { "name": "doggie", "photoUrls": [] }
 *               rulesConfig:
 *                 type: object
 *                 description: "Configuração opcional de regras customizadas para o Spectral."
 *                 example: { "operation-tags": true }
 *               loadTestOptions:
 *                 type: object
 *                 description: "Opções adicionais de teste do Autocannon. Limites padrão (default): duration ≤ 60s, connections ≤ 50, maxRequests ≤ 100.000, requestsPerSecond ≤ 1.000. Com allowHighLoad=true: duration ≤ 300s, connections ≤ 500, maxRequests ≤ 1.000.000, requestsPerSecond ≤ 10.000."
 *                 properties:
 *                   duration:
 *                     type: number
 *                     description: "Duração do teste em segundos (padrão máx. 60; com allowHighLoad máx. 300). Padrão 10 (5 para métodos mutantes). Precisa ser maior que 4 × targetLatency, para que um alvo que não responde seja contado como frustrado."
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     description: "Número de conexões concorrentes simultâneas (padrão máx. 50; com allowHighLoad máx. 500)."
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     description: "Latência alvo T em milissegundos para o Apdex (padrão 1000). Respostas 2xx/3xx com latência ≤ T são satisfeitas, ≤ 4T toleradas e acima disso frustradas; 5xx, timeouts e erros de conexão também são frustrados."
 *                     example: 1000
 *                   maxRequests:
 *                     type: number
 *                     description: "Quantidade máxima de requisições por alvo (padrão máx. 100.000; com allowHighLoad máx. 1.000.000). O teste termina ao atingir maxRequests ou duration, o que ocorrer primeiro. Não pode ser menor que connections."
 *                     example: 1000
 *                   requestsPerSecond:
 *                     type: number
 *                     description: "Taxa máxima de requisições por segundo (padrão máx. 1.000; com allowHighLoad máx. 10.000)."
 *                     example: 100
 *                   method:
 *                     type: string
 *                     description: "Método HTTP padrão global para o teste de carga. É sobrescrito pelo method definido individualmente no alvo (target.method tem precedência)."
 *                     enum: [GET, POST, PUT, DELETE, PATCH]
 *                     example: "GET"
 *                   headers:
 *                     type: object
 *                     additionalProperties:
 *                       type: string
 *                     description: "Headers HTTP customizados a serem enviados em todas as requisições do teste de carga."
 *                     example: { "Authorization": "Bearer token", "X-Custom-Header": "value" }
 *                   allowMutatingMethods:
 *                     type: boolean
 *                     description: "Opt-in explícito para permitir métodos HTTP mutantes (POST, PUT, DELETE, PATCH) no teste de carga."
 *                     default: false
 *                   body:
 *                     type: string
 *                     description: "Corpo padrão global em formato string/JSON. Aplicado exclusivamente a alvos com métodos mutantes (POST, PUT, PATCH) que não possuam payload próprio; ignorado em métodos não mutantes (GET, DELETE)."
 *                   allowHighLoad:
 *                     type: boolean
 *                     description: "Opt-in explícito para elevar os tetos de duration, connections, maxRequests e requestsPerSecond ao tier elevado. Use com cautela ao testar APIs de terceiros."
 *                     default: false
 *               weights:
 *                 type: object
 *                 description: "Pesos opcionais para o cálculo da nota final. A soma dos 3 pilares deve ser igual a 1. Valores omitidos assumem automaticamente o default de 1/3 (0.333...) e contam para a soma. Padrão 1/3 para cada pilar."
 *                 properties:
 *                   contract:
 *                     type: number
 *                     example: 0.5
 *                   performance:
 *                     type: number
 *                     example: 0.3
 *                   security:
 *                     type: number
 *                     example: 0.2
 *     responses:
 *       202:
 *         description: "Avaliação enfileirada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   format: uuid
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: "Erro de validação da requisição (exemplo: openApiUrl/targets ausentes, pesos inválidos, método mutante sem allowMutatingMethods, DELETE com path parametrizado ou limite de duração total excedido)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/evaluations/security:
 *   post:
 *     summary: "Executa auditoria de segurança HTTP de uma API"
 *     description: "Executa 8 verificações no servidor da API, agrupadas em 4 camadas com pesos ROC: transporte (0,5208: HTTPS, redirecionamento HTTP para HTTPS, HSTS), controle de acesso (0,2708: CORS, com sonda de Origin forjada), conteúdo (0,1458: X-Content-Type-Options, proteção contra frames via frame-ancestors da CSP ou X-Frame-Options) e vazamento (0,0625: Server, X-Powered-By). O peso de cada camada é dividido igualmente entre suas verificações; cada uma vale 1 (pass), 0,5 (warning) ou 0 (missing/error), e a nota (0-100) é a soma ponderada normalizada. Versão exposta em Server ou X-Powered-By vale 0. Se a sonda de CORS falhar em duas tentativas, o pilar falha em vez de pontuar a verificação. A severidade de cada achado é informativa e não entra na nota. O processo é enfileirado de forma assíncrona. Use GET /api/evaluations/{id} para acompanhar o resultado. Quando apiBaseUrl não é informada, a URL alvo é resolvida automaticamente a partir da especificação OpenAPI."
 *     tags: [Evaluation]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openApiUrl
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL raiz opcional para sobrescrever o servidor da API. Caso omitida, será resolvida automaticamente do contrato OpenAPI. Para resultados mais fiéis, prefira omitir este campo para que a auditoria reflita os headers do servidor público real."
 *                 example: "https://petstore.swagger.io/v2"
 *     responses:
 *       202:
 *         description: "Avaliação enfileirada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   format: uuid
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ausente, openApiUrl ou apiBaseUrl sem protocolo http/https)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /api/evaluations/{id}:
 *   get:
 *     summary: "Consulta o status e o resultado detalhado de uma avaliação"
 *     description: "Retorna o estado atual e os resultados consolidados da auditoria. Quando concluída (COMPLETED), exibe os relatórios de Spectral, Performance, Segurança e nota calculada. Avaliações vinculadas a um usuário autenticado só podem ser acessadas pelo próprio dono."
 *     tags: [Evaluation]
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "Identificador único UUID da avaliação retornado no endpoint de criação."
 *     responses:
 *       200:
 *         description: "Avaliação encontrada."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 openApiUrl:
 *                   type: string
 *                 apiBaseUrl:
 *                   type: string
 *                   nullable: true
 *                 targets:
 *                   type: array
 *                   nullable: true
 *                   description: "Lista de alvos configurados para o teste de performance."
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                       method:
 *                         type: string
 *                       payload:
 *                         nullable: true
 *                 evaluationType:
 *                   type: string
 *                   enum: [contract, performance, security, full]
 *                 status:
 *                   type: string
 *                   enum: [PENDING, RUNNING, COMPLETED, PARTIAL, FAILED]
 *                 finalScore:
 *                   type: number
 *                   nullable: true
 *                   description: "Nota final (0-100) = soma de pillarScores × scoring.pillarWeights. Nula em PARTIAL e FAILED."
 *                 pillarScores:
 *                   type: object
 *                   nullable: true
 *                   description: "Nota (0-100) de cada pilar que concluiu. Em PARTIAL traz só os pilares que rodaram; nulo em FAILED."
 *                   properties:
 *                     contract:
 *                       type: number
 *                     performance:
 *                       type: number
 *                     security:
 *                       type: number
 *                 scoring:
 *                   type: object
 *                   nullable: true
 *                   description: "Parâmetros efetivos usados no cálculo (padrões já aplicados), para reproduzir a nota a partir do registro. As chaves contract, performance e security só aparecem para os pilares que concluíram."
 *                   properties:
 *                     pillarWeights:
 *                       type: object
 *                       description: "Peso de cada pilar na nota final: 1 para avaliações de pilar único; no tipo full, os pesos informados ou 1/3 cada."
 *                       properties:
 *                         contract:
 *                           type: number
 *                         performance:
 *                           type: number
 *                         security:
 *                           type: number
 *                     contract:
 *                       type: object
 *                       properties:
 *                         severityWeights:
 *                           type: object
 *                           description: "Peso de cada severidade (padrão mesclado com severityWeights da requisição)."
 *                           additionalProperties:
 *                             type: number
 *                         rules:
 *                           type: array
 *                           description: "Regras do Spectral que entraram no denominador (ativas, do formato da especificação e com alvo no documento)."
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               severity:
 *                                 type: string
 *                                 enum: [Error, Warning, Info, Hint, Unknown]
 *                     performance:
 *                       type: object
 *                       properties:
 *                         targetLatency:
 *                           type: number
 *                           description: "Latência alvo T (ms) do Apdex; a zona frustrada começa em 4T."
 *                     security:
 *                       type: object
 *                       properties:
 *                         layerWeights:
 *                           type: object
 *                           description: "Peso de cada camada (transport, access, content, leakage)."
 *                           additionalProperties:
 *                             type: number
 *                         statusScores:
 *                           type: object
 *                           description: "Valor de cada status de verificação (pass, warning, missing, error)."
 *                           additionalProperties:
 *                             type: number
 *                 spectralResult:
 *                   type: object
 *                   nullable: true
 *                   description: "Resultado do pilar de contrato: ocorrências do Spectral e resumo por regra."
 *                   properties:
 *                     issues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           endpoint:
 *                             type: string
 *                           method:
 *                             type: string
 *                           rule:
 *                             type: string
 *                           message:
 *                             type: string
 *                           severity:
 *                             type: string
 *                             enum: [Error, Warning, Info, Hint, Unknown]
 *                     summary:
 *                       type: object
 *                       properties:
 *                         evaluatedRules:
 *                           type: integer
 *                           description: "Regras ativas, aplicáveis ao formato da especificação e com ao menos um alvo no documento, incluindo códigos extras reportados pelo Spectral (ex.: parser, invalid-ref)."
 *                         violatedRules:
 *                           type: integer
 *                           description: "Regras com ao menos uma ocorrência."
 *                         occurrencesByRule:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                 performanceResults:
 *                   type: array
 *                   nullable: true
 *                   description: "Resultados consolidados dos testes de carga para cada endpoint alvo. Disponível em avaliações com status COMPLETED, PARTIAL e também em FAILED quando o teste de performance tiver executado alvos (preservando o detalhe do erro por alvo)."
 *                   items:
 *                     type: object
 *                     properties:
 *                       path:
 *                         type: string
 *                         example: "/pet/findByStatus"
 *                       method:
 *                         type: string
 *                         example: "GET"
 *                       result:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           score:
 *                             type: number
 *                             nullable: true
 *                             description: "Nota Apdex do alvo (0-100) = (satisfeitas + toleradas/2) / amostra x 100. Nulo quando não há amostra válida (alvo não medido, fora da média do pilar)."
 *                           targetLatency:
 *                             type: number
 *                             description: "Latência alvo T (ms) usada no cálculo."
 *                           satisfied:
 *                             type: number
 *                             description: "Respostas 2xx/3xx com latência <= T."
 *                           tolerating:
 *                             type: number
 *                             description: "Respostas 2xx/3xx com latência > T e <= 4T."
 *                           frustrated:
 *                             type: number
 *                             description: "Respostas 2xx/3xx com latência > 4T, respostas 5xx, timeouts, erros de conexão e requisições sem resposta há mais de 4T no fim do teste."
 *                           sampleSize:
 *                             type: number
 *                             description: "Tamanho da amostra do Apdex (satisfeitas + toleradas + frustradas)."
 *                           excluded4xx:
 *                             type: number
 *                             description: "Respostas 4xx, excluídas da amostra."
 *                           serverErrors:
 *                             type: number
 *                             description: "Respostas 5xx (já contadas em frustrated)."
 *                           unanswered:
 *                             type: number
 *                             description: "Requisições ainda sem resposta há mais de 4T quando o teste terminou (já contadas em frustrated). As pendentes há menos de 4T ficam fora da amostra."
 *                           errorRate:
 *                             type: number
 *                             description: "(5xx + erros de conexão e timeouts + sem resposta) / (respostas + erros + sem resposta), de 0 a 1. Apenas diagnóstico; não entra na nota."
 *                           averageLatency:
 *                             type: number
 *                             description: "Latência média (ms) das respostas não 4xx."
 *                           totalRequests:
 *                             type: number
 *                           errors:
 *                             type: number
 *                           timeouts:
 *                             type: number
 *                           warnings:
 *                             type: array
 *                             description: "Avisos estruturados sobre a execução do teste (ex.: método mutante, body ausente). Use code para identificar o aviso."
 *                             items:
 *                               type: object
 *                               properties:
 *                                 code:
 *                                   type: string
 *                                   example: "PERF_MISSING_BODY"
 *                                 severity:
 *                                   type: string
 *                                 message:
 *                                   type: string
 *                                 recommendation:
 *                                   type: string
 *                                   nullable: true
 *                                 params:
 *                                   type: object
 *                                   nullable: true
 *                       error:
 *                         type: string
 *                         nullable: true
 *                         description: "Mensagem de erro caso a execução do teste de carga tenha falhado para este alvo."
 *                 securityResult:
 *                   type: array
 *                   nullable: true
 *                   description: "Array com as 8 verificações da auditoria de segurança HTTP (HTTPS, redirecionamento, HSTS, CORS, X-Content-Type-Options, frame-ancestors/X-Frame-Options, Server, X-Powered-By)."
 *                   items:
 *                     type: object
 *                     properties:
 *                       layer:
 *                         type: string
 *                         enum: [transport, access, content, leakage]
 *                         description: "Camada da verificação: transport (0,5208), access (0,2708), content (0,1458) ou leakage (0,0625)."
 *                       header:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [pass, warning, missing, error]
 *                       code:
 *                         type: string
 *                         description: "Identificador estável do achado."
 *                         example: "SEC_HSTS_MISSING"
 *                       severity:
 *                         type: string
 *                       message:
 *                         type: string
 *                       recommendation:
 *                         type: string
 *                         nullable: true
 *                       params:
 *                         type: object
 *                         nullable: true
 *                         description: "Valores usados na mensagem (ex.: maxAge, header, value, status, origin)."
 *                 failedPillars:
 *                   type: array
 *                   nullable: true
 *                   items:
 *                     type: object
 *                     properties:
 *                       pillar:
 *                         type: string
 *                       error:
 *                         type: string
 *                       code:
 *                         type: string
 *                         description: "Presente quando o pilar não foi executado por uma pré-condição (ex.: PERF_SKIPPED_INVALID_SPEC)."
 *                 errorMessage:
 *                   type: string
 *                   nullable: true
 *                   description: "Motivo do erro quando o status for FAILED. Quando a falha envolver o pilar de performance, o campo performanceResults também conterá o detalhamento por alvo."
 *       404:
 *         description: "Avaliação não encontrada, pertence a outro usuário ou id que não é UUID."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/contract', optionalAuth, validate(contractRequestSchema), evaluationController.evaluate('contract'));
router.post('/performance', optionalAuth, validate(performanceRequestSchema), evaluationController.evaluate('performance'));
router.post('/security', optionalAuth, validate(securityRequestSchema), evaluationController.evaluate('security'));
router.post('/full', optionalAuth, validate(fullEvaluationRequestSchema), evaluationController.evaluate('full'));
router.get('/:id', optionalAuth, validateIdParam('EVALUATION_NOT_FOUND'), evaluationController.getEvaluation);

export default router;
