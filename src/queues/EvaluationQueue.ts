import { EventEmitter } from 'events';
import {
    EvaluationType,
    IContractRequest,
    IPerformanceRequest,
    IFullEvaluationRequest,
} from '../interfaces/evaluation.interface.js';

export interface EvaluationJob {
    evaluationId: string;
    type: EvaluationType;
    params: IContractRequest | IPerformanceRequest | IFullEvaluationRequest;
}

class EvaluationQueue extends EventEmitter {
    enqueue(job: EvaluationJob): void {
        this.emit('evaluation', job);
    }
}

export const evaluationQueue = new EvaluationQueue();
