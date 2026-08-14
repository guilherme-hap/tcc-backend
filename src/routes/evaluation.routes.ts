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
 *     responses:
 *       200:
 *         description: Evaluation completed successfully. Returns the array of Spectral validations.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   code:
 *                     type: string
 *                     description: The violated rule code.
 *                     example: "operation-tags"
 *                   message:
 *                     type: string
 *                     description: Human-readable error description.
 *                     example: "Operation tags must be defined."
 *                   severity:
 *                     type: integer
 *                     description: Severity level (0 = Error, 1 = Warning, 2 = Info, 3 = Hint).
 *                     example: 1
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
router.post('/contract', evaluationController.evaluateContract);

export default router;
