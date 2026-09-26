import { Router } from 'express';
import { SavedApiController } from '../controllers/SavedApiController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
const controller = new SavedApiController();

/**
 * @openapi
 * tags:
 *   - name: SavedApi
 *     description: "Gerenciamento de APIs salvas pelo usuário. Todas as rotas exigem autenticação."
 *
 * /api/user/apis:
 *   post:
 *     summary: "Salva uma nova API para o usuário autenticado"
 *     description: "Registra uma API com URL do contrato OpenAPI e configurações padrão opcionais. A API salva pode ser usada posteriormente pelo frontend para preencher formulários de avaliação."
 *     tags: [SavedApi]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - openApiUrl
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Nome amigável para identificar a API salva."
 *                 example: "Petstore API"
 *               openApiUrl:
 *                 type: string
 *                 description: "URL direta para o arquivo JSON ou YAML da especificação OpenAPI."
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               apiBaseUrl:
 *                 type: string
 *                 description: "URL base opcional da API (sobrescreve o servidor definido no contrato)."
 *                 example: "https://petstore.swagger.io/v2"
 *               defaultSettings:
 *                 type: object
 *                 nullable: true
 *                 description: "Preferências de configuração padrão. Ao atualizar, o objeto é substituído por completo (sem merge com o valor anterior)."
 *                 properties:
 *                   rulesConfig:
 *                     type: object
 *                     description: "Configuração de regras customizadas do Spectral."
 *                     example: { "operation-tags": true }
 *                   loadTestOptions:
 *                     type: object
 *                     description: "Opções padrão de teste de carga."
 *                     properties:
 *                       duration:
 *                         type: number
 *                         example: 10
 *                       connections:
 *                         type: number
 *                         example: 10
 *     responses:
 *       201:
 *         description: "API salva com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavedApi'
 *       400:
 *         description: "Erro de validação (campos obrigatórios ausentes)."
 *       401:
 *         description: "Autenticação obrigatória."
 *
 *   get:
 *     summary: "Lista todas as APIs salvas do usuário autenticado"
 *     description: "Retorna apenas as APIs pertencentes ao usuário do token JWT, ordenadas pela data de criação (mais recentes primeiro)."
 *     tags: [SavedApi]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Lista de APIs salvas."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SavedApi'
 *       401:
 *         description: "Autenticação obrigatória."
 *
 * /api/user/apis/{id}:
 *   put:
 *     summary: "Atualiza uma API salva do usuário autenticado"
 *     description: "Atualização parcial — apenas os campos enviados são alterados. Campos aninhados (defaultSettings) são substituídos por completo, não mesclados com o valor anterior."
 *     tags: [SavedApi]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "ID da API salva."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               openApiUrl:
 *                 type: string
 *               apiBaseUrl:
 *                 type: string
 *                 nullable: true
 *               defaultSettings:
 *                 type: object
 *                 nullable: true
 *                 description: "Substituição completa do objeto de configurações padrão."
 *     responses:
 *       200:
 *         description: "API atualizada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SavedApi'
 *       400:
 *         description: "Corpo da requisição vazio."
 *       401:
 *         description: "Autenticação obrigatória."
 *       404:
 *         description: "API não encontrada."
 *
 *   delete:
 *     summary: "Remove uma API salva do usuário autenticado"
 *     tags: [SavedApi]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "ID da API salva."
 *     responses:
 *       200:
 *         description: "API removida com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Saved API deleted successfully"
 *       401:
 *         description: "Autenticação obrigatória."
 *       404:
 *         description: "API não encontrada."
 *
 * components:
 *   schemas:
 *     SavedApi:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         openApiUrl:
 *           type: string
 *         apiBaseUrl:
 *           type: string
 *           nullable: true
 *         defaultSettings:
 *           type: object
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
router.post('/', requireAuth, controller.create);
router.get('/', requireAuth, controller.list);
router.put('/:id', requireAuth, controller.update);
router.delete('/:id', requireAuth, controller.delete);

export default router;
