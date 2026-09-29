import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { validate } from '../middlewares/validate.js';
import { performanceRequestSchema, fullEvaluationRequestSchema } from '../schemas/evaluation.schema.js';

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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ausente)."
 *
 * /api/evaluations/performance:
 *   post:
 *     summary: "Executa teste de carga/performance em um endpoint alvo"
 *     description: "Realiza teste de estresse utilizando o Autocannon exclusivamente na rota informada em targetPath. Caso apiBaseUrl não seja fornecida, a URL base será resolvida automaticamente a partir da especificação OpenAPI informada em openApiUrl."
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
 *               - targetPath
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               targetPath:
 *                 type: string
 *                 description: "Rota específica da API a ser testada pelo Autocannon (exemplo: /orders ou /pet/findByStatus)."
 *                 example: "/pet/findByStatus"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL raiz opcional para sobrescrever o servidor da API. Caso omitida, será resolvida automaticamente do contrato OpenAPI."
 *                 example: "https://petstore.swagger.io/v2"
 *               targetMethod:
 *                 type: string
 *                 description: "Método HTTP a ser utilizado pelo teste de carga."
 *                 enum: [GET, POST, PUT, DELETE, PATCH]
 *                 example: "GET"
 *               payload:
 *                 description: "Corpo (payload) da requisição para testes de estresse em métodos como POST ou PUT."
 *                 example: { "status": "available" }
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
 *                   allowMutatingMethods:
 *                     type: boolean
 *                     description: "Opt-in explícito para permitir métodos HTTP mutantes (POST, PUT, DELETE, PATCH) no teste de carga. Obrigatório quando targetMethod for um método mutante."
 *                     default: false
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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ou targetPath ausentes)."
 *
 * /api/evaluations/full:
 *   post:
 *     summary: "Executa avaliação completa (Contrato global + Performance pontual + Segurança dos headers)"
 *     description: "Executa o linting do Spectral sobre toda a especificação OpenAPI informada em openApiUrl, o teste de carga com Autocannon pontualmente na rota indicada em targetPath e a auditoria de segurança dos headers HTTP do servidor. Ao final, pondera as notas individuais dos 3 pilares calculando o score global."
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
 *               - targetPath
 *             properties:
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI/Swagger (não utilize o link da interface HTML do Swagger UI)."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               targetPath:
 *                 type: string
 *                 description: "Rota específica da API a ser testada pelo Autocannon (exemplo: /orders ou /pet/findByStatus)."
 *                 example: "/pet/findByStatus"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL raiz opcional para sobrescrever o servidor da API. Caso omitida, será resolvida automaticamente do contrato OpenAPI."
 *                 example: "https://petstore.swagger.io/v2"
 *               targetMethod:
 *                 type: string
 *                 description: "Método HTTP para o teste de carga."
 *                 enum: [GET, POST, PUT, DELETE, PATCH]
 *                 example: "GET"
 *               payload:
 *                 description: "Corpo (payload) da requisição para testes de estresse em métodos como POST ou PUT."
 *                 example: { "status": "available" }
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
 *                   allowMutatingMethods:
 *                     type: boolean
 *                     description: "Opt-in explícito para permitir métodos HTTP mutantes (POST, PUT, DELETE, PATCH) no teste de carga."
 *                     default: false
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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl/targetPath ausentes ou pesos inválidos)."
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
 *         description: "Erro de validação da requisição (exemplo: openApiUrl ausente)."
 *
 * /api/evaluations/{id}:
 *   get:
 *     summary: "Consulta o status e o resultado detalhado de uma avaliação"
 *     description: "Retorna o estado atual e os resultados consolidados da auditoria. Quando concluída (COMPLETED), exibe os relatórios de Spectral, Autocannon, Segurança e nota calculada. Avaliações vinculadas a um usuário autenticado só podem ser acessadas pelo próprio dono."
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
 *                 targetPath:
 *                   type: string
 *                   nullable: true
 *                 targetMethod:
 *                   type: string
 *                   nullable: true
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
 *                 autocannonResult:
 *                   type: object
 *                   nullable: true
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
 *                       severity:
 *                         type: string
 *                       message:
 *                         type: string
 *                       recommendation:
 *                         type: string
 *                         nullable: true
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
 *                   description: "Motivo do erro quando o status for FAILED."
 *       404:
 *         description: "Avaliação não encontrada ou pertence a outro usuário."
 */
router.post('/contract', optionalAuth, evaluationController.evaluateContract);
router.post('/performance', optionalAuth, validate(performanceRequestSchema), evaluationController.evaluatePerformance);
router.post('/security', optionalAuth, evaluationController.evaluateSecurity);
router.post('/full', optionalAuth, validate(fullEvaluationRequestSchema), evaluationController.evaluateFull);
router.get('/:id', optionalAuth, evaluationController.getEvaluation);

export default router;
