import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../messages/errors.js';

const SWAGGER_UI_CSP = [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
].join('; ');

function swaggerUiCsp(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Content-Security-Policy', SWAGGER_UI_CSP);
    next();
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API de Avaliação - TCC',
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Token JWT obtido via POST /api/auth/login ou /api/auth/register.',
                },
            },
            schemas: {
                ErrorResponse: {
                    type: 'object',
                    required: ['error', 'code'],
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Mensagem em português, pronta para exibição.',
                            example: 'A requisição contém campos inválidos.',
                        },
                        code: {
                            type: 'string',
                            enum: ERROR_CODES,
                            description: 'Identificador estável do erro. Os mesmos códigos aparecem em failedPillars[].code e performanceResults[].code no GET /api/evaluations/{id}.',
                            example: 'VALIDATION_FAILED',
                        },
                        issues: {
                            type: 'array',
                            description: 'Presente só quando code = VALIDATION_FAILED: um item por campo inválido.',
                            items: {
                                type: 'object',
                                required: ['path', 'message'],
                                properties: {
                                    path: {
                                        type: 'string',
                                        description: 'Caminho do campo no corpo da requisição, com pontos (vazio quando o erro é do corpo inteiro).',
                                        example: 'targets.0.path',
                                    },
                                    message: {
                                        type: 'string',
                                        example: 'Informe o path do alvo',
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
    app.use('/api-docs', swaggerUiCsp, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
