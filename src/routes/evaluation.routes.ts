import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';

const router = Router();
const evaluationController = new EvaluationController();

/**
 * @openapi
 * tags:
 *   name: Contract Evaluation
 *   description: Routes responsible for the black-box analysis of OpenAPI/Swagger contracts.
 *
 * /api/evaluate/contract:
 *   post:
 *     summary: Executes API contract linting
 *     description: Downloads the OpenAPI file (JSON/YAML) from the provided URL and runs a validation based on the official rulesets (OAS). Returns a list of errors, warnings, and formatting hints.
 *     tags: [Contract Evaluation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - swaggerUrl
 *             properties:
 *               swaggerUrl:
 *                 type: string
 *                 description: The public URL where the target API contract is hosted.
 *                 example: "https://petstore.swagger.io/v2/swagger.json"
 *               baseUrl:
 *                 type: string
 *                 description: Optional base URL of the target API for live tests/evaluations.
 *                 example: "https://petstore.swagger.io/v2"
 *               rulesConfig:
 *                 type: object
 *                 description: Optional custom rules configuration.
 *                 example: { "operation-tags": true }
 *     responses:
 *       202:
 *         description: Evaluation queued successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Avaliação enfileirada com sucesso"
 *                 evaluationId:
 *                   type: string
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *       400:
 *         description: Request validation error (e.g., URL not provided).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "The 'swaggerUrl' property is required."
 *       500:
 *         description: Internal server error (e.g., download failure or incompatible format).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to evaluate API contract: Request failed with status code 404"
 */
router.post('/contract', evaluationController.evaluateApi);

export default router;
