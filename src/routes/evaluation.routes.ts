import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';

const router = Router();
const evaluationController = new EvaluationController();

/**
 * @openapi
 * tags:
 *   - name: Evaluation
 *     description: Endpoints responsible for triggering and querying OpenAPI contract evaluations and performance tests.
 *
 * /api/evaluate/contract:
 *   post:
 *     summary: Executes API contract linting
 *     description: Downloads the OpenAPI file (JSON/YAML) from the provided URL and runs a validation based on the official rulesets (OAS). The evaluation is queued and processed asynchronously. Use GET /api/evaluate/:id to poll for results.
 *     tags: [Evaluation]
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
 *                 evaluationId:
 *                   type: string
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Request validation error (e.g., URL not provided).
 *
 * /api/evaluate/performance:
 *   post:
 *     summary: Executes API load/performance test
 *     description: Runs a load test against the target API using Autocannon. Resolves the base URL from the OpenAPI spec if not provided. The evaluation is queued and processed asynchronously.
 *     tags: [Evaluation]
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
 *                 description: Optional base URL of the target API. If not provided, it will be resolved from the OpenAPI spec.
 *                 example: "https://petstore.swagger.io/v2"
 *               loadTestOptions:
 *                 type: object
 *                 description: Optional load test configuration.
 *                 properties:
 *                   duration:
 *                     type: number
 *                     description: Duration of the test in seconds.
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     description: Number of concurrent connections.
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     description: Target latency threshold in ms for Apdex calculation.
 *                     example: 300
 *                   maxRequests:
 *                     type: number
 *                     description: Maximum total requests (stops when reached or duration expires).
 *                     example: 1000
 *                   requestsPerSecond:
 *                     type: number
 *                     description: Maximum requests per second.
 *                     example: 100
 *                   method:
 *                     type: string
 *                     enum: [GET, POST, PUT, DELETE, PATCH]
 *                   headers:
 *                     type: object
 *                   body:
 *                     type: string
 *     responses:
 *       202:
 *         description: Evaluation queued successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Request validation error.
 *
 * /api/evaluate/full:
 *   post:
 *     summary: Executes full API evaluation (contract + performance)
 *     description: Runs both contract linting and load testing in parallel, then calculates a weighted final score. Weights default to 50/50 if not specified. If provided, weights must sum to 1.
 *     tags: [Evaluation]
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
 *                 description: Optional base URL. Resolved from spec if not provided.
 *                 example: "https://petstore.swagger.io/v2"
 *               rulesConfig:
 *                 type: object
 *                 description: Optional custom Spectral rules configuration.
 *                 example: { "operation-tags": true }
 *               loadTestOptions:
 *                 type: object
 *                 description: Optional load test configuration.
 *                 properties:
 *                   duration:
 *                     type: number
 *                     example: 10
 *                   connections:
 *                     type: number
 *                     example: 10
 *                   targetLatency:
 *                     type: number
 *                     example: 300
 *                   maxRequests:
 *                     type: number
 *                     example: 1000
 *                   requestsPerSecond:
 *                     type: number
 *                     example: 100
 *               weights:
 *                 type: object
 *                 description: Optional weights for the final score calculation. Must sum to 1 if provided. Defaults to 50/50.
 *                 properties:
 *                   contract:
 *                     type: number
 *                     example: 0.6
 *                   performance:
 *                     type: number
 *                     example: 0.4
 *     responses:
 *       202:
 *         description: Evaluation queued successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 evaluationId:
 *                   type: string
 *                   example: "123e4567-e89b-12d3-a456-426614174000"
 *                 status:
 *                   type: string
 *                   example: "PENDING"
 *       400:
 *         description: Validation error (e.g., weights don't sum to 1).
 *
 * /api/evaluate/{id}:
 *   get:
 *     summary: Get evaluation status and results
 *     description: Returns the current status and results of an evaluation. COMPLETED, PARTIAL, and FAILED are all valid evaluation outcomes returned with HTTP 200. PARTIAL means at least one pillar succeeded and at least one failed (finalScore will be null). FAILED means no pillar succeeded.
 *     tags: [Evaluation]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The evaluation ID returned by the POST endpoint.
 *     responses:
 *       200:
 *         description: Evaluation found (any status).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 swaggerUrl:
 *                   type: string
 *                 evaluationType:
 *                   type: string
 *                   enum: [contract, performance, full]
 *                 status:
 *                   type: string
 *                   enum: [PENDING, RUNNING, COMPLETED, PARTIAL, FAILED]
 *                 finalScore:
 *                   type: number
 *                   nullable: true
 *                   description: Weighted final score (0-100). Null if PARTIAL or FAILED.
 *                 spectralResult:
 *                   type: array
 *                   nullable: true
 *                 autocannonResult:
 *                   type: object
 *                   nullable: true
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
 *                   description: Error reason when status is FAILED.
 *       404:
 *         description: Evaluation not found.
 */
router.post('/contract', evaluationController.evaluateContract);
router.post('/performance', evaluationController.evaluatePerformance);
router.post('/full', evaluationController.evaluateFull);
router.get('/:id', evaluationController.getEvaluation);

export default router;
