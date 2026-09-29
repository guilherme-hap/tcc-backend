import pkgSpectralCore from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import { oas } from '@stoplight/spectral-rulesets';
import axios from 'axios';
import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';
import { parseOpenApiContent } from '../utils/fetchOpenApiSpec.js';

const { Spectral, Document } = pkgSpectralCore;
const { Json, Yaml } = pkgSpectralParsers;

export class SpectralService {
    public async analyze(openApiUrl: string, rulesConfig: Record<string, boolean> = {}): Promise<SpectralResponseDto[]> {
        const response = await axios.get(openApiUrl);
        const { format, rawString } = parseOpenApiContent(response.data);
        const parser = format === 'yaml' ? Yaml : Json;

        const customRules: Record<string, any> = {};
        for (const [key, value] of Object.entries(rulesConfig)) {
            customRules[key] = value ? true : 'off';
        }

        const spectral = new Spectral();
        spectral.setRuleset({
            extends: [
                [oas as any, 'recommended'],
            ],
            rules: customRules
        });

        const document = new Document(rawString, parser as any, openApiUrl);

        const rawResults = await spectral.run(document);

        return SpectralResponseDto.formatSpectralResults(rawResults);
    }
}