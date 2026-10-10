import type { IScorePart, ISecurityCheckResult, SecurityLayer } from '../interfaces/evaluation.interface.js';
import { scorePart } from './scorePart.js';

export const SECURITY_LAYER_WEIGHTS: Record<SecurityLayer, number> = {
    transport: 0.5208,
    access: 0.2708,
    content: 0.1458,
    leakage: 0.0625,
};

export const SECURITY_STATUS_SCORE: Record<ISecurityCheckResult['status'], number> = {
    pass: 1,
    warning: 0.5,
    missing: 0,
    error: 0,
};

export function calculateSecurityScore(results: ISecurityCheckResult[]): { score: number; breakdown: IScorePart[] } {
    const layers: { layer: SecurityLayer; weight: number; score: number }[] = [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const layer of Object.keys(SECURITY_LAYER_WEIGHTS) as SecurityLayer[]) {
        const checks = results.filter(r => r.layer === layer);
        if (checks.length === 0) continue;

        const layerWeight = SECURITY_LAYER_WEIGHTS[layer];
        const layerScore = checks.reduce((sum, r) => sum + SECURITY_STATUS_SCORE[r.status], 0) / checks.length;
        weightedSum += layerWeight * layerScore;
        totalWeight += layerWeight;
        layers.push({ layer, weight: layerWeight, score: layerScore });
    }

    if (totalWeight === 0) return { score: 0, breakdown: [] };
    return {
        score: Math.round((100 * weightedSum / totalWeight) * 100) / 100,
        breakdown: layers.map(({ layer, weight, score }) => scorePart(layer, weight / totalWeight, 100 * score)),
    };
}
