import core from '@stoplight/spectral-core';
import parsers from '@stoplight/spectral-parsers';
import rulesets from '@stoplight/spectral-rulesets';
import axios from 'axios';

// Extrai as classes de dentro do objeto importado
const { Spectral, Document } = core;

export class SpectralService {
  async evaluateContract(swaggerUrl: string) {
    try {
      const response = await axios.get(swaggerUrl, { 
        responseType: 'text' 
      });

      const document = new Document(
        response.data, 
        parsers.Yaml, 
        swaggerUrl
      );

      const spectral = new Spectral();

      spectral.setRuleset(rulesets.oas as any);

      const results = await spectral.run(document);
      
      return results;

    } catch (error: any) {
      throw new Error(`Falha ao avaliar o contrato da API: ${error.message}`);
    }
  }
}