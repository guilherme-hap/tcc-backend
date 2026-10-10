import axios from 'axios';
import * as yaml from 'js-yaml';
import { AppError } from '../errors/AppError.js';

export type OpenApiFormat = 'json' | 'yaml';

export interface ParsedOpenApiContent {
    data: any;
    format: OpenApiFormat;
    rawString: string;
}

const FETCH_TIMEOUT_MS = Number(process.env.OPENAPI_FETCH_TIMEOUT_MS) || 15_000;

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function throwInvalidRootError(value: unknown): never {
    const received = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
    throw new AppError('SPEC_INVALID_ROOT', { received });
}

function describeYamlError(error: unknown): string {
    if (error instanceof yaml.YAMLException) {
        return error.mark
            ? `${error.reason}, linha ${error.mark.line + 1}, coluna ${error.mark.column + 1}`
            : error.reason;
    }
    return error instanceof Error ? error.message : String(error);
}

export function parseOpenApiContent(content: string): ParsedOpenApiContent {
    let parsedJson: unknown;
    let isJsonSyntaxValid = false;

    try {
        parsedJson = JSON.parse(content);
        isJsonSyntaxValid = true;
    } catch {
        isJsonSyntaxValid = false;
    }

    if (isJsonSyntaxValid) {
        if (!isRecord(parsedJson)) {
            throwInvalidRootError(parsedJson);
        }
        return {
            data: parsedJson,
            format: 'json',
            rawString: content,
        };
    }

    let parsedYaml: unknown;
    try {
        parsedYaml = yaml.load(content, { schema: yaml.JSON_SCHEMA });
    } catch (yamlErr: unknown) {
        throw new AppError('SPEC_PARSE_FAILED', { detail: describeYamlError(yamlErr) });
    }

    if (!isRecord(parsedYaml)) {
        throwInvalidRootError(parsedYaml);
    }

    return {
        data: parsedYaml,
        format: 'yaml',
        rawString: content,
    };
}

export async function fetchOpenApiContent(openApiUrl: string): Promise<ParsedOpenApiContent> {
    let response;
    try {
        response = await axios.get<string>(openApiUrl, {
            timeout: FETCH_TIMEOUT_MS,
            maxContentLength: 5 * 1024 * 1024,
            maxRedirects: 3,
            responseType: 'text',
            transformResponse: (r) => r,
        });
    } catch (err: any) {
        const reason = err?.response?.status
            ? `HTTP ${err.response.status}`
            : (err?.code ?? err?.message ?? 'unknown error');
        throw new AppError('SPEC_FETCH_FAILED', { reason: String(reason) });
    }
    return parseOpenApiContent(response.data);
}
