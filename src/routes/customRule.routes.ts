import { Router } from 'express';
import { CustomRuleController } from '../controllers/CustomRuleController.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
const controller = new CustomRuleController();

/**
 * @openapi
 * tags:
 *   - name: CustomRule
 *     description: "Gerenciamento de regras customizadas de avaliação. Todas as rotas exigem autenticação."
 *
 * /api/user/rules:
 *   post:
 *     summary: "Cria uma nova regra customizada para o usuário autenticado"
 *     description: "Registra um conjunto de regras Spectral personalizadas com pesos de severidade opcionais."
 *     tags: [CustomRule]
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
 *               - rulesConfig
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Nome amigável para identificar o conjunto de regras."
 *                 example: "Regras rigorosas"
 *               rulesConfig:
 *                 type: object
 *                 description: "Mapa de regras Spectral (chave: nome da regra, valor: boolean habilitado/desabilitado). Todos os valores devem ser booleanos."
 *                 additionalProperties:
 *                   type: boolean
 *                 example: { "operation-tags": true, "info-contact": false }
 *               severityWeights:
 *                 type: object
 *                 nullable: true
 *                 description: "Pesos customizados para cada nível de severidade. Chaves válidas: Error, Warning, Info, Hint, Unknown. Valores devem ser numéricos não-negativos."
 *                 example: { "Error": 10, "Warning": 5, "Info": 1 }
 *     responses:
 *       201:
 *         description: "Regra customizada criada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomRule'
 *       400:
 *         description: "Erro de validação (campos obrigatórios ausentes, valor não-booleano em rulesConfig, ou severityWeights com chave/valor inválido)."
 *       401:
 *         description: "Autenticação obrigatória."
 *
 *   get:
 *     summary: "Lista todas as regras customizadas do usuário autenticado"
 *     description: "Retorna apenas as regras pertencentes ao usuário do token JWT, ordenadas pela data de criação (mais recentes primeiro)."
 *     tags: [CustomRule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Lista de regras customizadas."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CustomRule'
 *       401:
 *         description: "Autenticação obrigatória."
 *
 * /api/user/rules/{id}:
 *   put:
 *     summary: "Atualiza uma regra customizada do usuário autenticado"
 *     description: "Atualização parcial — apenas os campos enviados são alterados. Campos aninhados (rulesConfig, severityWeights) são substituídos por completo, não mesclados com o valor anterior."
 *     tags: [CustomRule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "ID da regra customizada."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               rulesConfig:
 *                 type: object
 *                 description: "Substituição completa do mapa de regras. Todos os valores devem ser booleanos."
 *                 additionalProperties:
 *                   type: boolean
 *               severityWeights:
 *                 type: object
 *                 nullable: true
 *                 description: "Substituição completa dos pesos de severidade."
 *     responses:
 *       200:
 *         description: "Regra atualizada com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomRule'
 *       400:
 *         description: "Corpo da requisição vazio ou valores inválidos."
 *       401:
 *         description: "Autenticação obrigatória."
 *       404:
 *         description: "Regra não encontrada."
 *
 *   delete:
 *     summary: "Remove uma regra customizada do usuário autenticado"
 *     tags: [CustomRule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: "ID da regra customizada."
 *     responses:
 *       200:
 *         description: "Regra removida com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Custom rule deleted successfully"
 *       401:
 *         description: "Autenticação obrigatória."
 *       404:
 *         description: "Regra não encontrada."
 *
 * components:
 *   schemas:
 *     CustomRule:
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
 *         rulesConfig:
 *           type: object
 *           additionalProperties:
 *             type: boolean
 *         severityWeights:
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
