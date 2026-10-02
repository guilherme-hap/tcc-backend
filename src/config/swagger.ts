import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response, NextFunction } from 'express';

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
        },
    },
    apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
    app.use('/api-docs', swaggerUiCsp, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
