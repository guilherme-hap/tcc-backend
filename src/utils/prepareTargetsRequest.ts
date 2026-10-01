import { validateLoadTestMethod } from './httpMethodUtils.js';
import { validateTotalDuration } from './loadTestLimits.js';
import { loadTestOptionsSchema } from '../schemas/loadTestOptions.schema.js';
import { AppError } from '../errors/AppError.js';
import { IPerformanceRequest } from '../interfaces/evaluation.interface.js';

type TargetsRequest = Pick<IPerformanceRequest, 'targets' | 'loadTestOptions'>;

export function prepareTargetsRequest<T extends TargetsRequest>(data: T): T {
    let loadTestOptions = data.loadTestOptions;
    if (loadTestOptions) {
        const result = loadTestOptionsSchema.safeParse(loadTestOptions);
        if (!result.success) {
            throw new AppError(result.error.issues.map((i) => i.message).join('; '), 400);
        }
        loadTestOptions = result.data;
    }

    const requestData: T = {
        ...data,
        ...(loadTestOptions !== undefined ? { loadTestOptions } : {}),
    };

    if (!requestData.targets || requestData.targets.length === 0) {
        throw new AppError('targets is required and must contain at least one target', 400);
    }

    validateTotalDuration(requestData);

    requestData.targets.forEach((target, index) => {
        try {
            validateLoadTestMethod({
                targetMethod: target.method,
                targetPath: target.path,
                loadTestMethod: requestData.loadTestOptions?.method,
                allowMutatingMethods: requestData.loadTestOptions?.allowMutatingMethods,
            });
        } catch (err: any) {
            const message = err instanceof Error ? err.message : String(err);
            throw new AppError(`targets[${index}]: ${message}`, 400);
        }
    });

    return requestData;
}
