import type { IScorePart } from '../interfaces/evaluation.interface.js';
import { round } from './round.js';

export function scorePart(id: string, weight: number, score: number): IScorePart {
    return {
        id,
        weight: round(weight, 4),
        score: round(score, 2),
        points: round(weight * score, 2),
        maxPoints: round(weight * 100, 2),
    };
}
