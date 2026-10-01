import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { validate } from '../middlewares/validate.js';
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
 *     description: "Baixa o arquivo OpenAPI (JSON/YAML) diretamente da URL informada e valida as regras oficiais do Spectral sobre a especificação completa. O processo é enfileirado de forma assíncrona. Use GET /api/evaluations/{id} para acompanhar o resultado."
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
 *                     description: "Duração do teste em segundos (padrão máx. 60; com allowHighLoad máx. 300)."
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     description: "Número de conexões concorrentes simultâneas (padrão máx. 50; com allowHighLoad máx. 500)."
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     description: "Limite de latência alvo em milissegundos para cálculo do índice Apdex."
 *                     example: 300
 *                   maxRequests:
 *                     type: number
 *                     description: "Quantidade máxima de requisições a disparar (padrão máx. 100.000; com allowHighLoad máx. 1.000.000)."
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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ou targets ausentes, path vazio, método inválido ou limite de duração total excedido)."
 *
 * /api/evaluations/full:
 *   post:
 *     summary: "Executa avaliação completa (Contrato global + Performance pontual + Segurança dos headers)"
 *     description: "Executa o linting do Spectral sobre toda a especificação OpenAPI informada em openApiUrl, o teste de carga com Autocannon sequencialmente nas rotas indicadas em targets e a auditoria de segurança dos headers HTTP do servidor. Ao final, pondera as notas individuais dos 3 pilares calculando o score global."
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
 *                     description: "Duração do teste em segundos (padrão máx. 60; com allowHighLoad máx. 300)."
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     description: "Número de conexões concorrentes simultâneas (padrão máx. 50; com allowHighLoad máx. 500)."
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     description: "Limite de latência alvo em milissegundos para cálculo do índice Apdex."
 *                     example: 300
 *                   maxRequests:
 *                     type: number
 *                     description: "Quantidade máxima de requisições a disparar (padrão máx. 100.000; com allowHighLoad máx. 1.000.000)."
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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl/targets ausentes, pesos inválidos ou limite de duração total excedido)."
 *
 * /api/evaluations/security:
 *   post:
 *     summary: "Executa auditoria de segurança dos headers HTTP de uma API"
 *     description: "Analisa os headers de segurança HTTP (HSTS, CSP, X-Content-Type-Options, CORS, Server, X-Powered-By) do servidor da API. O processo é enfileirado de forma assíncrona. Use GET /api/evaluations/{id} para acompanhar o resultado. Quando apiBaseUrl não é informada, a URL alvo é resolvida automaticamente a partir da especificação OpenAPI."
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
 *                   description: "Nota final ponderada (0-100)."
 *                 appliedWeights:
 *                   type: object
 *                   nullable: true
 *                   description: "Pesos aplicados no cálculo da nota final. Populado apenas em avaliações do tipo 'full'. Quando omitido na requisição, reflete o default (1/3 para cada pilar)."
 *                   properties:
 *                     contract:
 *                       type: number
 *                     performance:
 *                       type: number
 *                     security:
 *                       type: number
 *                 spectralResult:
 *                   type: array
 *                   nullable: true
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
 *                           averageLatency:
 *                             type: number
 *                           totalRequests:
 *                             type: number
 *                           errors:
 *                             type: number
 *                           timeouts:
 *                             type: number
 *                           nonSuccessResponses:
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
 *                   description: "Array de resultados da auditoria de headers de segurança HTTP."
 *                   items:
 *                     type: object
 *                     properties:
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
 *                         description: "Valores usados na mensagem (ex.: maxAge, header, value)."
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
 *                 errorMessage:
 *                   type: string
 *                   nullable: true
 *                   description: "Motivo do erro quando o status for FAILED. Quando a falha envolver o pilar de performance, o campo performanceResults também conterá o detalhamento por alvo."
 *       404:
 *         description: "Avaliação não encontrada ou pertence a outro usuário."
 */
router.post('/contract', optionalAuth, validate(contractRequestSchema), evaluationController.evaluateContract);
router.post('/performance', optionalAuth, validate(performanceRequestSchema), evaluationController.evaluatePerformance);
router.post('/security', optionalAuth, validate(securityRequestSchema), evaluationController.evaluateSecurity);
router.post('/full', optionalAuth, validate(fullEvaluationRequestSchema), evaluationController.evaluateFull);
router.get('/:id', optionalAuth, evaluationController.getEvaluation);

export default router;
