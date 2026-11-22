import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppDataSource } from '../../src/config/data-source.js';
import authRoutes from '../../src/routes/auth.routes.js';
import savedApiRoutes from '../../src/routes/savedApi.routes.js';
import { send, startApp, type TestServer } from './http.js';

const SECRET = 'Bearer credencial-de-teste';
const payload = {
    name: 'API protegida',
    openApiUrl: 'https://api.test.local/openapi.json',
    defaultSettings: { loadTestOptions: { connections: 5, headers: { Authorization: SECRET } } },
};

let server: TestServer;

beforeAll(async () => {
    server = await startApp((app) => {
        app.use('/api/auth', authRoutes);
        app.use('/api/user/apis', savedApiRoutes);
    });
});

afterAll(() => server.close());
afterEach(() => vi.restoreAllMocks());

const account = async (email = 'dono@test.local'): Promise<string> => {
    const { body } = await send(`${server.url}/api/auth/register`, 'POST', { body: { email, password: 'senha-de-teste' } });
    return body.token;
};

const storedSettings = async (id: string) => {
    const [row] = await AppDataSource.query('SELECT default_settings FROM saved_apis WHERE id = $1', [id]);
    return row.default_settings;
};

describe('cabeçalhos de APIs salvas', () => {
    it('guarda o valor cifrado e devolve o original ao dono', async () => {
        const token = await account();
        const created = await send(`${server.url}/api/user/apis`, 'POST', { token, body: payload });

        const stored = await storedSettings(created.body.id);
        const listed = await send(`${server.url}/api/user/apis`, 'GET', { token });

        expect(created.status).toBe(201);
        expect(created.body.defaultSettings.loadTestOptions.headers.Authorization).toBe(SECRET);
        expect(JSON.stringify(stored)).not.toContain('credencial-de-teste');
        expect(stored.loadTestOptions.connections).toBe(5);
        expect(listed.body[0].defaultSettings.loadTestOptions.headers.Authorization).toBe(SECRET);
    });

    it('não cifra de novo um valor que já estava salvo ao editar outro campo', async () => {
        const token = await account();
        const { body } = await send(`${server.url}/api/user/apis`, 'POST', { token, body: payload });

        const updated = await send(`${server.url}/api/user/apis/${body.id}`, 'PUT', { token, body: { name: 'Novo nome' } });
        const listed = await send(`${server.url}/api/user/apis`, 'GET', { token });

        expect(updated.status).toBe(200);
        expect(updated.body.defaultSettings.loadTestOptions.headers.Authorization).toBe(SECRET);
        expect(listed.body[0].name).toBe('Novo nome');
        expect(listed.body[0].defaultSettings.loadTestOptions.headers.Authorization).toBe(SECRET);
    });

    it('aceita API sem configurações e sem cabeçalhos', async () => {
        const token = await account();
        const empty = await send(`${server.url}/api/user/apis`, 'POST', { token, body: { name: 'a', openApiUrl: payload.openApiUrl } });
        const rules = await send(`${server.url}/api/user/apis`, 'POST', {
            token,
            body: { name: 'b', openApiUrl: payload.openApiUrl, defaultSettings: { rulesConfig: { 'info-contact': false } } },
        });

        expect(empty.body.defaultSettings).toBeNull();
        expect(rules.body.defaultSettings).toEqual({ rulesConfig: { 'info-contact': false } });
    });

    it('não revela um valor cifrado copiado para a API de outra conta', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const victim = await account();
        const attacker = await account('outra@test.local');
        const { body: victimApi } = await send(`${server.url}/api/user/apis`, 'POST', { token: victim, body: payload });
        const { body: attackerApi } = await send(`${server.url}/api/user/apis`, 'POST', {
            token: attacker,
            body: { ...payload, defaultSettings: { loadTestOptions: { headers: { Authorization: 'valor-proprio' } } } },
        });

        await AppDataSource.query(
            'UPDATE saved_apis SET default_settings = (SELECT default_settings FROM saved_apis WHERE id = $1) WHERE id = $2',
            [victimApi.id, attackerApi.id],
        );
        const listed = await send(`${server.url}/api/user/apis`, 'GET', { token: attacker });

        expect(listed.status).toBe(500);
        expect(JSON.stringify(listed.body)).not.toContain('credencial-de-teste');
        expect((await send(`${server.url}/api/user/apis`, 'GET', { token: victim })).body[0].defaultSettings.loadTestOptions.headers.Authorization).toBe(SECRET);
    });

    it('não revela um valor movido para outro cabeçalho da mesma API', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const token = await account();
        const { body } = await send(`${server.url}/api/user/apis`, 'POST', {
            token,
            body: { ...payload, defaultSettings: { loadTestOptions: { headers: { Authorization: SECRET, 'X-Debug': 'publico' } } } },
        });

        await AppDataSource.query(
            `UPDATE saved_apis SET default_settings = jsonb_set(default_settings, '{loadTestOptions,headers,X-Debug}', default_settings#>'{loadTestOptions,headers,Authorization}') WHERE id = $1`,
            [body.id],
        );
        const listed = await send(`${server.url}/api/user/apis`, 'GET', { token });

        expect(listed.status).toBe(500);
        expect(JSON.stringify(listed.body)).not.toContain('credencial-de-teste');
    });

    it('não mostra a API de uma conta para outra', async () => {
        const owner = await account();
        const other = await account('outra@test.local');
        const { body } = await send(`${server.url}/api/user/apis`, 'POST', { token: owner, body: payload });

        expect((await send(`${server.url}/api/user/apis`, 'GET', { token: other })).body).toEqual([]);
        expect((await send(`${server.url}/api/user/apis/${body.id}`, 'PUT', { token: other, body: { name: 'x' } })).status).toBe(404);
    });
});
