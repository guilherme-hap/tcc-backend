import { EventEmitter } from 'events';
import {
    EvaluationType,
    IContractRequest,
    IPerformanceRequest,
    ISecurityRequest,
    IFullEvaluationRequest,
} from '../interfaces/evaluation.interface.js';

export interface EvaluationJob {
    evaluationId: string;
    type: EvaluationType;
    params: IContractRequest | IPerformanceRequest | ISecurityRequest | IFullEvaluationRequest;
}

class EvaluationQueue extends EventEmitter {
    enqueue(job: EvaluationJob): void {
        this.emit('evaluation', job);
    }
}

export const evaluationQueue = new EvaluationQueue();
