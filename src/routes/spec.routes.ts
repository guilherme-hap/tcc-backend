import { Router } from 'express';
import { SpecController } from '../controllers/SpecController.js';
import { optionalAuth } from '../middlewares/optionalAuth.js';
import { validate } from '../middlewares/validate.js';
import { specOperationsRequestSchema } from '../schemas/spec.schema.js';

const router = Router();
const controller = new SpecController();

/**
 * @openapi
 * tags:
 *   - name: Spec
 *     description: "Leitura da especificação OpenAPI informada pelo usuário, para preencher os formulários de avaliação."
 *
 * /api/specs/operations:
 *   post:
 *     summary: "Lista as operações declaradas em uma especificação OpenAPI"
 *     description: "Baixa a especificação da URL informada e devolve as operações (path + método) que podem ser usadas como alvos do teste de carga, para o usuário escolher em vez de digitar. É uma consulta: não cria avaliação nem grava nada, e a especificação é baixada de novo quando a avaliação roda. A URL vai no corpo, e não na query string, para não ficar em logs nem em cache. Só entram os métodos aceitos pelo teste de carga (GET, POST, PUT, DELETE, PATCH), na ordem em que os paths aparecem no documento. A especificação não é validada aqui: documento com erros de contrato ainda é listado, e especificação sem paths devolve operations vazio. Path declarado por $ref não é listado."
 *     tags: [Spec]
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
 *     responses:
 *       200:
 *         description: "Operações da especificação."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SpecOperations'
 *       400:
 *         description: "openApiUrl ausente ou sem protocolo http/https (VALIDATION_FAILED); especificação que não pôde ser baixada (SPEC_FETCH_FAILED), que não é JSON nem YAML (SPEC_PARSE_FAILED), cuja raiz não é um objeto (SPEC_INVALID_ROOT) ou que não declara openapi nem swagger (SPEC_NOT_OPENAPI)."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: "Token enviado, mas inválido ou expirado. Sem o cabeçalho Authorization a rota responde normalmente."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * components:
 *   schemas:
 *     SpecOperations:
 *       type: object
 *       required: [title, oasVersion, baseUrl, operations]
 *       properties:
 *         title:
 *           type: string
 *           nullable: true
 *           description: "Título declarado em info.title (nulo quando ausente)."
 *           example: "Swagger Petstore"
 *         oasVersion:
 *           type: string
 *           nullable: true
 *           enum: ["2.0", "3.0", "3.1", null]
 *           description: "Versão do OpenAPI declarada no documento, no mesmo formato de oasVersions em GET /api/rules. Nula quando a versão declarada não é uma das três."
 *           example: "2.0"
 *         baseUrl:
 *           type: string
 *           description: "URL base que a avaliação usa quando apiBaseUrl não é informada: o primeiro servidor da especificação (ou schemes, host e basePath no Swagger 2.0) e, na falta deles, a origem da URL da especificação."
 *           example: "https://petstore.swagger.io/v2"
 *         operations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SpecOperation'
 *     SpecOperation:
 *       type: object
 *       required: [path, method, operationId, summary, tags, deprecated, mutating, pathParams, hasJsonBody, requiresAuth]
 *       properties:
 *         path:
 *           type: string
 *           description: "Path como declarado na especificação; é o valor de targets[].path."
 *           example: "/pet/{petId}"
 *         method:
 *           type: string
 *           enum: [GET, POST, PUT, DELETE, PATCH]
 *           description: "Método HTTP; é o valor de targets[].method."
 *           example: "GET"
 *         operationId:
 *           type: string
 *           nullable: true
 *           example: "getPetById"
 *         summary:
 *           type: string
 *           nullable: true
 *           example: "Find pet by ID"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["pet"]
 *         deprecated:
 *           type: boolean
 *         mutating:
 *           type: boolean
 *           description: "true para POST, PUT, PATCH e DELETE: o teste de carga só aceita o alvo com loadTestOptions.allowMutatingMethods = true."
 *         pathParams:
 *           type: array
 *           description: "Parâmetros {nome} do path, na ordem em que aparecem. São as chaves aceitas em targets[].pathParams; sem valor informado, o teste de carga gera um valor sintético (exceto em DELETE, que exige todos)."
 *           items:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "petId"
 *               type:
 *                 type: string
 *                 nullable: true
 *                 description: "Tipo declarado para o parâmetro (nulo quando a especificação não o declara)."
 *                 example: "integer"
 *         hasJsonBody:
 *           type: boolean
 *           description: "true quando o método aceita corpo (POST, PUT, PATCH) e a operação declara um corpo JSON com schema: sem payload no alvo, o teste de carga gera um corpo sintético. false nesses métodos significa que o alvo sai sem corpo, a menos que payload seja informado."
 *         requiresAuth:
 *           type: boolean
 *           description: "true quando a operação (ou a especificação, por padrão) declara security sem alternativa anônima. Sem o cabeçalho de autenticação em loadTestOptions.headers, as respostas tendem a ser 401 e ficam fora da amostra."
 */
router.post('/operations', optionalAuth, validate(specOperationsRequestSchema), controller.listOperations);

export default router;
