import axios from 'axios';
import * as yaml from 'js-yaml';
import { AppError } from '../errors/AppError.js';

export type OpenApiFormat = 'json' | 'yaml';

export interface ParsedOpenApiContent {
    data: any;
    format: OpenApiFormat;
    rawString: string;
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function throwInvalidRootError(value: unknown): never {
    const typeDesc = Array.isArray(value) ? 'an array' : (value === null ? 'null' : typeof value);
    throw new AppError(
        `The OpenAPI specification must have an object as its root (received ${typeDesc}) — did you point openApiUrl to the wrong endpoint?`,
        400
    );
}

export function parseOpenApiContent(content: unknown): ParsedOpenApiContent {
    if (typeof content === 'string') {
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
            parsedYaml = yaml.load(content);
        } catch (yamlErr: any) {
            const yamlMessage = yamlErr instanceof Error ? yamlErr.message : String(yamlErr);
            throw new AppError(
                `The OpenAPI specification is neither valid JSON nor valid YAML (YAML: ${yamlMessage})`,
                400
            );
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

    if (!isRecord(content)) {
        throwInvalidRootError(content);
    }

    return {
        data: content,
        format: 'json',
        rawString: JSON.stringify(content),
    };
}

export async function fetchOpenApiSpec(openApiUrl: string): Promise<any> {
    const response = await axios.get(openApiUrl);
    const { data } = parseOpenApiContent(response.data);
    return data;
}

