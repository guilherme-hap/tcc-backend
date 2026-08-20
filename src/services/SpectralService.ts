import pkgSpectralCore from '@stoplight/spectral-core';
import pkgSpectralParsers from '@stoplight/spectral-parsers';
import { oas } from '@stoplight/spectral-rulesets';
import axios from 'axios';
import { AppDataSource } from '../config/data-source.js';
import { Evaluation } from '../entities/Evaluation.js';
import { SpectralResponseDto } from '../dtos/SpectralResponseDto.js';

const { Spectral, Document } = pkgSpectralCore;
const { Json } = pkgSpectralParsers;

export class SpectralService {
    public async processEvaluation(evaluationId: string, swaggerUrl: string, userRulesConfig: Record<string, boolean> = {}) {
        const evaluationRepository = AppDataSource.getRepository(Evaluation);

        try {
            await evaluationRepository.update(evaluationId, { status: 'IN_PROGRESS' });

            const response = await axios.get(swaggerUrl);
            const data = response.data;
            const stringifiedData = typeof data === 'string' ? data : JSON.stringify(data);

            const customRules: Record<string, any> = {};
            for (const [key, value] of Object.entries(userRulesConfig)) {
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

            const formattedResults = SpectralResponseDto.formatSpectralResults(rawResults);

            await evaluationRepository.update(evaluationId, {
                spectralResult: formattedResults,
                status: 'COMPLETED'
            });

        } catch (error: any) {
            console.error(`Error processing evaluation ${evaluationId}:`, error);
            await evaluationRepository.update(evaluationId, {
                status: 'ERROR',
                spectralResult: { error: error.message || 'Unknown error' }
            });
        }
    }
}