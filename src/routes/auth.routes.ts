import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';

const router = Router();
const authController = new AuthController();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: "Endpoints de autenticação (registro e login)."
 *
 * /api/auth/register:
 *   post:
 *     summary: "Registra um novo usuário"
 *     description: "Cria uma conta com email e senha. Retorna os dados do usuário e um token JWT válido por 8 horas."
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: "Endereço de e-mail único do usuário."
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: "Senha com no mínimo 8 caracteres."
 *                 example: "myS3cur3P@ss"
 *     responses:
 *       201:
 *         description: "Usuário registrado com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                 token:
 *                   type: string
 *                   description: "Token JWT para autenticação nas próximas requisições."
 *                   example: "eyJhbGciOiJIUzI1NiIs..."
 *       400:
 *         description: "Erro de validação (email inválido ou senha muito curta)."
 *       409:
 *         description: "Email já está em uso."
 *
 * /api/auth/login:
 *   post:
 *     summary: "Autentica um usuário existente"
 *     description: "Valida as credenciais e retorna um token JWT."
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: "Endereço de e-mail do usuário."
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: "Senha do usuário."
 *                 example: "myS3cur3P@ss"
 *     responses:
 *       200:
 *         description: "Login realizado com sucesso."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     email:
 *                       type: string
 *                       example: "user@example.com"
 *                 token:
 *                   type: string
 *                   description: "Token JWT para autenticação."
 *                   example: "eyJhbGciOiJIUzI1NiIs..."
 *       401:
 *         description: "Credenciais inválidas."
 */
router.post('/register', authController.register);
router.post('/login', authController.login);

export default router;
