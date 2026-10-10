import type { IScorePart } from '../interfaces/evaluation.interface.js';

function round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

export function scorePart(id: string, weight: number, score: number): IScorePart {
    return {
        id,
        weight: round(weight, 4),
        score: round(score, 2),
        points: round(weight * score, 2),
        maxPoints: round(weight * 100, 2),
    };
}
