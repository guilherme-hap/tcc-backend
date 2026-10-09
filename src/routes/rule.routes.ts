import { Router } from 'express';
import { RuleController } from '../controllers/RuleController.js';

const router = Router();
const controller = new RuleController();

/**
 * @openapi
 * tags:
 *   - name: Rule
 *     description: "Catálogo das regras do Spectral usadas no pilar de contrato."
 *
 * /api/rules:
 *   get:
 *     summary: "Lista as regras do Spectral que podem ser ligadas ou desligadas"
 *     description: "Retorna as regras do ruleset OpenAPI do Spectral, em ordem alfabética, com a severidade e o estado padrão de cada uma. Os nomes são as chaves aceitas em rulesConfig (avaliações de contrato e completa, regras customizadas e configurações padrão de APIs salvas): true liga a regra, false desliga, e regra omitida fica no estado indicado em enabledByDefault. Rota pública; o conteúdo só muda com a versão do Spectral. Ocorrências com os códigos parser, invalid-ref e unrecognized-format não são regras do ruleset e não aparecem aqui."
 *     tags: [Rule]
 *     responses:
 *       200:
 *         description: "Catálogo de regras."
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SpectralRule'
 *
 * components:
 *   schemas:
 *     SpectralRule:
 *       type: object
 *       required: [name, description, severity, enabledByDefault, oasVersions, documentationUrl]
 *       properties:
 *         name:
 *           type: string
 *           description: "Nome da regra; é a chave usada em rulesConfig e o valor de rule nas ocorrências do contrato."
 *           example: "operation-tags"
 *         description:
 *           type: string
 *           nullable: true
 *           description: "Descrição fornecida pelo Spectral, em inglês (nula quando a regra não tem descrição)."
 *           example: "Operation must have non-empty \"tags\" array."
 *         severity:
 *           type: string
 *           enum: [Error, Warning, Info, Hint, Unknown]
 *           description: "Severidade padrão da regra; define o peso dela na nota de contrato."
 *           example: "Warning"
 *         enabledByDefault:
 *           type: boolean
 *           description: "true quando a regra faz parte do conjunto recomendado e roda sem precisar de rulesConfig."
 *         oasVersions:
 *           type: array
 *           description: "Versões do OpenAPI às quais a regra se aplica. Regra de outra versão é ignorada na avaliação, mesmo ligada."
 *           items:
 *             type: string
 *             enum: ["2.0", "3.0", "3.1"]
 *           example: ["2.0", "3.0", "3.1"]
 *         documentationUrl:
 *           type: string
 *           nullable: true
 *           description: "Link para a documentação da regra no site do Spectral."
 */
router.get('/', controller.list);

export default router;
