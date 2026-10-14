import type { ISpecOperations } from '../interfaces/spec.interface.js';
import type { SpecOperationsInput } from '../schemas/spec.schema.js';
import { fetchOpenApiContent } from '../utils/fetchOpenApiSpec.js';
import { listSpecOperations } from '../utils/listSpecOperations.js';

export class SpecService {
    async listOperations({ openApiUrl }: SpecOperationsInput): Promise<ISpecOperations> {
        const { data } = await fetchOpenApiContent(openApiUrl);
        return listSpecOperations(data, openApiUrl);
    }
}
