import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const EXIT_PASSED = 0;
const EXIT_REJECTED = 1;
const EXIT_ERROR = 2;

const EVALUATION_TYPES = ['contract', 'performance', 'security', 'full'];
const RUNNING_STATUSES = ['PENDING', 'RUNNING'];
const PILLAR_LABELS: Record<string, string> = {
    contract: 'Contrato',
    performance: 'Performance',
    security: 'Segurança',
};

const USAGE = `Uso: node dist/cli/audit.js --request <arquivo.json> [opções]

Envia uma avaliação ao auditor, aguarda o resultado e encerra com:
  0  aprovada   1  reprovada   2  erro de execução (uso, rede, validação ou tempo esgotado)

Opções:
  --request <arquivo>   corpo do pedido em JSON, igual ao do POST /api/evaluations/{tipo} (obrigatório)
  --type <tipo>         contract | performance | security | full (padrão: full)
  --api <url>           endereço do auditor (padrão: variável AUDITOR_URL ou http://localhost:3000)
  --min-score <nota>    nota final mínima (0-100); substitui o minScore do arquivo
  --timeout <segundos>  tempo máximo de espera pelo resultado (padrão: 900)
  --interval <segundos> intervalo entre consultas (padrão: 3)
  --output <arquivo>    grava o resultado completo em JSON
  --help                mostra esta ajuda

Sem nota mínima, a avaliação é aprovada quando termina COMPLETED.`;

interface ApiError {
    error?: string;
    code?: string;
    issues?: { path: string; message: string }[];
}

interface EvaluationResult {
    id: string;
    evaluationType: string;
    status: string;
    finalScore: number | null;
    passed: boolean | null;
    pillarScores: Record<string, number> | null;
    failedPillars: { pillar: string; error: string }[] | null;
    errorMessage: string | null;
    requestSettings: { minScore?: number } | null;
}

class CliFailure extends Error { }

function fail(message: string): never {
    throw new CliFailure(message);
}

function formatScore(score: number | null | undefined): string {
    return score === null || score === undefined ? 'sem nota' : score.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function pillarScoreRows(evaluation: EvaluationResult): [string, string][] {
    const scores = evaluation.pillarScores ?? {};
    return Object.keys(PILLAR_LABELS)
        .filter((pillar) => pillar in scores)
        .map((pillar) => [PILLAR_LABELS[pillar], formatScore(scores[pillar])]);
}

function failedPillarRows(evaluation: EvaluationResult): [string, string][] {
    return (evaluation.failedPillars ?? []).map((failed) => [PILLAR_LABELS[failed.pillar] ?? failed.pillar, failed.error]);
}

function generalError(evaluation: EvaluationResult): string | null {
    const repeated = (evaluation.failedPillars ?? []).some((failed) => failed.error === evaluation.errorMessage);
    return repeated ? null : evaluation.errorMessage;
}

function parsePositive(value: string, option: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        fail(`--${option} precisa ser um número maior que zero (recebido: ${value}).`);
    }
    return parsed;
}

function parseOptions() {
    try {
        return parseArgs({
            options: {
                request: { type: 'string' },
                type: { type: 'string', default: 'full' },
                api: { type: 'string', default: process.env.AUDITOR_URL || 'http://localhost:3000' },
                'min-score': { type: 'string' },
                timeout: { type: 'string', default: '900' },
                interval: { type: 'string', default: '3' },
                output: { type: 'string' },
                help: { type: 'boolean', default: false },
            },
        }).values;
    } catch (error) {
        fail(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    }
}

async function readRequest(path: string): Promise<Record<string, unknown>> {
    let content: string;
    try {
        const bytes = await readFile(path);
        const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8';
        content = new TextDecoder(encoding).decode(bytes);
    } catch (error) {
        fail(`não foi possível ler ${path} (${error instanceof Error ? error.message : String(error)}).`);
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
    }
    fail(`${path} não contém um objeto JSON válido.`);
}

async function callApi(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
    let response: Response;
    try {
        response = await fetch(url, { ...init, headers: { ...init?.headers, connection: 'close' } });
    } catch (error) {
        const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : String(error);
        fail(`não foi possível acessar o auditor em ${url} (${cause}).`);
    }

    const text = await response.text();
    try {
        return { status: response.status, body: JSON.parse(text) };
    } catch {
        fail(`resposta inesperada do auditor em ${url} (HTTP ${response.status}).`);
    }
}

function describeApiError(status: number, body: unknown): string {
    const { error, code, issues } = body as ApiError;
    const lines = [`o auditor recusou o pedido (HTTP ${status}${code ? `, ${code}` : ''}): ${error ?? 'sem detalhes'}`];
    for (const issue of issues ?? []) {
        lines.push(`  - ${issue.path || '(corpo)'}: ${issue.message}`);
    }
    return lines.join('\n');
}

function summarize(evaluation: EvaluationResult, approved: boolean): string[] {
    const minScore = evaluation.requestSettings?.minScore;
    const lines = [
        `Avaliação ${evaluation.id} (${evaluation.evaluationType}): ${evaluation.status}`,
        `Nota final: ${formatScore(evaluation.finalScore)}${minScore === undefined ? '' : ` (mínima exigida: ${formatScore(minScore)})`}`,
    ];
    for (const [pillar, score] of pillarScoreRows(evaluation)) {
        lines.push(`  ${pillar}: ${score}`);
    }
    for (const [pillar, error] of failedPillarRows(evaluation)) {
        lines.push(`  ${pillar}: não concluído. ${error}`);
    }
    const error = generalError(evaluation);
    if (error) {
        lines.push(`Erro: ${error}`);
    }
    lines.push(`Resultado: ${approved ? 'APROVADA' : 'REPROVADA'}`);
    return lines;
}

function toMarkdown(evaluation: EvaluationResult, approved: boolean, resultUrl: string): string {
    const minScore = evaluation.requestSettings?.minScore;
    const error = generalError(evaluation);
    const rows = [
        ['Resultado', approved ? 'Aprovada' : 'Reprovada'],
        ['Status', evaluation.status],
        ['Nota final', formatScore(evaluation.finalScore)],
        ['Nota mínima', minScore === undefined ? 'não informada' : formatScore(minScore)],
        ...pillarScoreRows(evaluation),
        ...failedPillarRows(evaluation).map(([pillar, failure]) => [pillar, `não concluído: ${failure}`]),
        ...(error ? [['Erro', error]] : []),
    ];
    return [
        `### Auditoria da API (${evaluation.evaluationType})`,
        '',
        '| Item | Valor |',
        '| --- | --- |',
        ...rows.map(([item, value]) => `| ${item} | ${value.replaceAll('|', '\\|')} |`),
        '',
        `Resultado completo: ${resultUrl}`,
        '',
    ].join('\n');
}

async function run(): Promise<number> {
    const options = parseOptions();

    if (options.help) {
        console.log(USAGE);
        return EXIT_PASSED;
    }
    if (!options.request) {
        fail(`informe o arquivo do pedido com --request.\n\n${USAGE}`);
    }
    if (!EVALUATION_TYPES.includes(options.type)) {
        fail(`--type precisa ser um de: ${EVALUATION_TYPES.join(', ')} (recebido: ${options.type}).`);
    }

    const timeoutMs = parsePositive(options.timeout, 'timeout') * 1000;
    const intervalMs = parsePositive(options.interval, 'interval') * 1000;
    const apiUrl = options.api.replace(/\/+$/, '');

    const request = await readRequest(options.request);
    if (options['min-score'] !== undefined) {
        const minScore = Number(options['min-score']);
        if (!Number.isFinite(minScore)) {
            fail(`--min-score precisa ser um número (recebido: ${options['min-score']}).`);
        }
        request.minScore = minScore;
    }

    const created = await callApi(`${apiUrl}/api/evaluations/${options.type}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
    });
    if (created.status !== 202) {
        fail(describeApiError(created.status, created.body));
    }

    const { evaluationId } = created.body as { evaluationId: string };
    const resultUrl = `${apiUrl}/api/evaluations/${evaluationId}`;
    console.log(`Avaliação ${evaluationId} enfileirada em ${apiUrl}.`);

    const deadline = Date.now() + timeoutMs;
    let evaluation: EvaluationResult;
    let lastStatus = '';

    while (true) {
        const fetched = await callApi(resultUrl);
        if (fetched.status !== 200) {
            fail(describeApiError(fetched.status, fetched.body));
        }
        evaluation = fetched.body as EvaluationResult;

        if (evaluation.status !== lastStatus) {
            console.log(`Status: ${evaluation.status}`);
            lastStatus = evaluation.status;
        }
        if (!RUNNING_STATUSES.includes(evaluation.status)) {
            break;
        }
        if (Date.now() + intervalMs > deadline) {
            fail(`tempo esgotado após ${timeoutMs / 1000} s; a avaliação continua em andamento no auditor (${resultUrl}).`);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const approved = evaluation.passed ?? evaluation.status === 'COMPLETED';

    console.log(summarize(evaluation, approved).join('\n'));
    console.log(`Resultado completo: ${resultUrl}`);

    if (options.output) {
        await writeFile(options.output, `${JSON.stringify(evaluation, null, 2)}\n`);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, toMarkdown(evaluation, approved, resultUrl));
    }

    return approved ? EXIT_PASSED : EXIT_REJECTED;
}

try {
    process.exitCode = await run();
} catch (error) {
    if (!(error instanceof CliFailure)) {
        throw error;
    }
    console.error(`Erro: ${error.message}`);
    process.exitCode = EXIT_ERROR;
}
