import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import authRoutes from '../../src/routes/auth.routes.js';
import { loadTestAuth } from '../../src/middlewares/loadTestAuth.js';
import { optionalAuth, type AuthenticatedRequest } from '../../src/middlewares/optionalAuth.js';
import { send, startApp, type TestServer } from './http.js';

const credentials = { email: 'pessoa@test.local', password: 'senha-de-teste' };
let server: TestServer;

beforeAll(async () => {
    server = await startApp((app) => {
        app.use('/api/auth', authRoutes);
        app.post('/load', loadTestAuth, (req: AuthenticatedRequest, res) => {
            res.json({ userId: req.userId ?? null });
        });
        app.get('/optional', optionalAuth, (req: AuthenticatedRequest, res) => {
            res.json({ userId: req.userId ?? null });
        });
    });
});

afterAll(() => server.close());
afterEach(() => vi.unstubAllEnvs());

const register = async (email = credentials.email) => {
    const { body } = await send(`${server.url}/api/auth/register`, 'POST', { body: { ...credentials, email } });
    return body as { token: string; user: { id: string } };
};

describe('sessão', () => {
    it('aceita o token emitido no cadastro e no login', async () => {
        const created = await register();
        const login = await send(`${server.url}/api/auth/login`, 'POST', { body: credentials });

        expect(login.status).toBe(200);
        expect((await send(`${server.url}/api/auth/me`, 'GET', { token: created.token })).status).toBe(200);
        expect((await send(`${server.url}/api/auth/me`, 'GET', { token: login.body.token })).body.user.id).toBe(created.user.id);
    });

    it('recusa senha errada e e-mail repetido', async () => {
        await register();

        expect((await send(`${server.url}/api/auth/login`, 'POST', { body: { ...credentials, password: 'outra-senha' } })).status).toBe(401);
        expect((await send(`${server.url}/api/auth/register`, 'POST', { body: credentials })).status).toBe(409);
    });

    it('revoga no servidor todos os tokens da conta ao sair', async () => {
        const first = await register();
        const second = (await send(`${server.url}/api/auth/login`, 'POST', { body: credentials })).body;

        expect((await send(`${server.url}/api/auth/logout`, 'POST', { token: first.token })).status).toBe(204);

        for (const token of [first.token, second.token]) {
            const response = await send(`${server.url}/api/auth/me`, 'GET', { token });
            expect(response.status).toBe(401);
            expect(response.body.code).toBe('AUTH_INVALID_TOKEN');
        }
    });

    it('não afeta a sessão de outra conta e permite entrar de novo', async () => {
        const first = await register();
        const other = await register('outra@test.local');

        await send(`${server.url}/api/auth/logout`, 'POST', { token: first.token });
        const again = await send(`${server.url}/api/auth/login`, 'POST', { body: credentials });

        expect((await send(`${server.url}/api/auth/me`, 'GET', { token: other.token })).status).toBe(200);
        expect((await send(`${server.url}/api/auth/me`, 'GET', { token: again.body.token })).status).toBe(200);
    });

    it('exige token para sair', async () => {
        expect((await send(`${server.url}/api/auth/logout`, 'POST')).status).toBe(401);
    });

    it('recusa token sem versão, de conta inexistente ou com assinatura errada', async () => {
        const { user } = await register();
        const tokens = [
            jwt.sign({ sub: user.id }, 'test-secret'),
            jwt.sign({ sub: '00000000-0000-4000-8000-000000000000', ver: 0 }, 'test-secret'),
            jwt.sign({ sub: user.id, ver: 0 }, 'outro-segredo'),
        ];

        for (const token of tokens) {
            expect((await send(`${server.url}/api/auth/me`, 'GET', { token })).status).toBe(401);
        }
    });
});

describe('autenticação das avaliações', () => {
    it('mantém a avaliação anônima quando não há token', async () => {
        expect((await send(`${server.url}/optional`, 'GET')).body.userId).toBeNull();
        expect((await send(`${server.url}/load`, 'POST')).status).toBe(200);
    });

    it('recusa token revogado mesmo na rota de autenticação opcional', async () => {
        const { token } = await register();
        await send(`${server.url}/api/auth/logout`, 'POST', { token });

        expect((await send(`${server.url}/optional`, 'GET', { token })).status).toBe(401);
    });

    it('exige conta para teste de carga em instalação pública', async () => {
        vi.stubEnv('PUBLIC_DEPLOYMENT', 'true');
        const { token, user } = await register();

        const anonymous = await send(`${server.url}/load`, 'POST');
        const authenticated = await send(`${server.url}/load`, 'POST', { token });

        expect(anonymous.status).toBe(401);
        expect(anonymous.body.code).toBe('LOAD_TEST_AUTH_REQUIRED');
        expect(authenticated.body.userId).toBe(user.id);
    });
});
