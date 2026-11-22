import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const EVALUATION_ID = '11111111-1111-4111-8111-111111111111';
const seen: { method?: string; headers: IncomingHttpHeaders }[] = [];
let finalScore = 90;
let server: Server;
let url: string;
let directory: string;
let requestFile: string;

beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'specping-cli-'));
    requestFile = join(directory, 'request.json');
    await writeFile(requestFile, JSON.stringify({ openApiUrl: 'https://api.test.local/openapi.json' }));

    server = createServer((req, res) => {
        seen.push({ method: req.method, headers: req.headers });
        req.resume();
        req.on('end', () => {
            res.setHeader('content-type', 'application/json');
            if (req.method === 'POST') {
                res.statusCode = 202;
                res.end(JSON.stringify({ evaluationId: EVALUATION_ID }));
                return;
            }
            res.end(JSON.stringify({
                id: EVALUATION_ID,
                evaluationType: 'full',
                status: 'COMPLETED',
                finalScore,
                passed: finalScore >= 70,
                pillarScores: { contract: finalScore },
                steps: [],
                errorMessage: null,
                requestSettings: { minScore: 70 },
                startedAt: null,
                finishedAt: null,
            }));
        });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
});

beforeEach(() => {
    seen.length = 0;
    finalScore = 90;
});

function runCli(token?: string): Promise<number | null> {
    const { AUDITOR_TOKEN: _ignored, GITHUB_STEP_SUMMARY: _summary, ...env } = process.env;
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            ['--import', 'tsx', 'src/cli/audit.ts', '--api', url, '--request', requestFile, '--interval', '0.05'],
            { env: token ? { ...env, AUDITOR_TOKEN: token } : env, stdio: 'ignore' },
        );
        child.on('error', reject);
        child.on('close', resolve);
    });
}

describe('cliente de CI', () => {
    it('envia o token no pedido e na consulta do resultado', async () => {
        expect(await runCli('token-de-teste')).toBe(0);

        expect(seen.map((request) => request.method)).toEqual(['POST', 'GET']);
        for (const request of seen) {
            expect(request.headers.authorization).toBe('Bearer token-de-teste');
        }
    });

    it('não envia cabeçalho de autenticação sem a variável', async () => {
        expect(await runCli()).toBe(0);

        for (const request of seen) {
            expect(request.headers.authorization).toBeUndefined();
        }
    });

    it('encerra com código 1 quando a avaliação é reprovada', async () => {
        finalScore = 50;

        expect(await runCli('token-de-teste')).toBe(1);
    });
});
