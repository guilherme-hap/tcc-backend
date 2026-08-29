import pkgSpectralCore from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import { oas } from '@stoplight/spectral-rulesets';
import axios from 'axios';
import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';

const { Spectral, Document } = pkgSpectralCore;
const { Json } = pkgSpectralParsers;

export class SpectralService {
    public async analyze(swaggerUrl: string, rulesConfig: Record<string, boolean> = {}): Promise<SpectralResponseDto[]> {
        const response = await axios.get(swaggerUrl);
        const data = response.data;
        const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);

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

        const document = new Document(stringifiedData, Json as any, swaggerUrl);

        const rawResults = await spectral.run(document);

        return SpectralResponseDto.formatSpectralResults(rawResults);
    }
}