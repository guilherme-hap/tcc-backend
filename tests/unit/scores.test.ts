import { describe, expect, it } from 'vitest';
import type { ISecurityCheckResult, ISpectralIssue, ISpectralRule } from '../../src/interfaces/evaluation.interface.js';
import { buildContractResult, calculateContractScore } from '../../src/utils/calculateContractScore.js';
import { calculateSecurityScore } from '../../src/utils/calculateSecurityScore.js';
import { evaluationPassed } from '../../src/utils/qualityGate.js';
import { scorePart } from '../../src/utils/scorePart.js';
import { resolveWeights } from '../../src/utils/weights.js';

const rule = (name: string, severity: ISpectralRule['severity']) => ({ name, severity }) as ISpectralRule;
const issue = (code: string, severity: ISpectralIssue['severity']) => ({ rule: code, severity }) as ISpectralIssue;
const check = (layer: ISecurityCheckResult['layer'], status: ISecurityCheckResult['status']) => ({ layer, status }) as ISecurityCheckResult;

const RULES = [rule('a', 'Error'), rule('b', 'Warning'), rule('c', 'Info')];

describe('nota de contrato', () => {
    it('vale 100 sem violações', () => {
        expect(calculateContractScore([], RULES).score).toBe(100);
    });

    it('pondera a regra violada pela severidade', () => {
        expect(calculateContractScore([issue('b', 'Warning')], RULES).score).toBe(71.11);
        expect(calculateContractScore([issue('a', 'Error')], RULES).score).toBe(44.44);
    });

    it('conta cada regra uma única vez, qualquer que seja o número de ocorrências', () => {
        const once = calculateContractScore([issue('b', 'Warning')], RULES).score;
        const many = calculateContractScore(Array.from({ length: 500 }, () => issue('b', 'Warning')), RULES).score;

        expect(many).toBe(once);
    });

    it('vale 0 quando todas as regras são violadas', () => {
        expect(calculateContractScore(RULES.map((r) => issue(r.name, r.severity)), RULES).score).toBe(0);
    });

    it('inclui no denominador uma regra violada fora da lista aplicável', () => {
        const { score } = calculateContractScore([issue('x', 'Error')], [rule('a', 'Error')]);

        expect(score).toBe(50);
    });

    it('vale 100 sem regras aplicáveis', () => {
        expect(calculateContractScore([], [])).toEqual({ score: 100, breakdown: [] });
    });

    it('aceita pesos de severidade personalizados', () => {
        const { score } = calculateContractScore([issue('b', 'Warning')], RULES, { Error: 0, Warning: 1, Info: 1 });

        expect(score).toBe(50);
    });

    it('resume regras avaliadas, violadas e ocorrências', () => {
        const { summary } = buildContractResult({ issues: [issue('b', 'Warning'), issue('b', 'Warning')], rules: RULES } as never);

        expect(summary).toEqual({ evaluatedRules: 3, violatedRules: 1, occurrencesByRule: { b: 2 } });
    });
});

describe('nota de segurança', () => {
    it('vale 100 com todas as camadas atendidas', () => {
        const results = [check('transport', 'pass'), check('access', 'pass'), check('content', 'pass'), check('leakage', 'pass')];

        expect(calculateSecurityScore(results).score).toBe(100);
    });

    it('dá meio crédito para atendimento parcial', () => {
        const results = [check('transport', 'warning'), check('access', 'warning'), check('content', 'warning'), check('leakage', 'warning')];

        expect(calculateSecurityScore(results).score).toBe(50);
    });

    it('renormaliza os pesos pelas camadas presentes', () => {
        expect(calculateSecurityScore([check('transport', 'pass'), check('access', 'missing')]).score).toBe(65.79);
    });

    it('usa a média das verificações dentro da camada', () => {
        expect(calculateSecurityScore([check('access', 'pass'), check('access', 'missing')]).score).toBe(50);
    });

    it('trata erro como não atendido e lista vazia como 0', () => {
        expect(calculateSecurityScore([check('transport', 'error')]).score).toBe(0);
        expect(calculateSecurityScore([])).toEqual({ score: 0, breakdown: [] });
    });
});

describe('composição da nota', () => {
    it('usa pesos iguais por padrão e aceita substituição parcial', () => {
        expect(resolveWeights().contract).toBeCloseTo(1 / 3);
        expect(resolveWeights({ security: 0.5 })).toMatchObject({ security: 0.5, contract: 1 / 3 });
    });

    it('calcula os pontos de cada parte', () => {
        expect(scorePart('contract', 0.25, 80)).toEqual({ id: 'contract', weight: 0.25, score: 80, points: 20, maxPoints: 25 });
    });
});

describe('critério de aprovação', () => {
    const evaluation = (status: string, finalScore: number | null, minScore?: number) => ({
        status,
        finalScore,
        requestSettings: minScore === undefined ? null : { minScore },
    }) as Parameters<typeof evaluationPassed>[0];

    it('não decide sem nota mínima ou com a avaliação em andamento', () => {
        expect(evaluationPassed(evaluation('COMPLETED', 90))).toBeNull();
        expect(evaluationPassed(evaluation('RUNNING', null, 70))).toBeNull();
        expect(evaluationPassed(evaluation('PENDING', null, 70))).toBeNull();
    });

    it('aprova a partir da nota mínima, inclusive', () => {
        expect(evaluationPassed(evaluation('COMPLETED', 70, 70))).toBe(true);
        expect(evaluationPassed(evaluation('COMPLETED', 69.99, 70))).toBe(false);
    });

    it('reprova avaliação parcial ou com falha', () => {
        expect(evaluationPassed(evaluation('PARTIAL', null, 0))).toBe(false);
        expect(evaluationPassed(evaluation('FAILED', null, 0))).toBe(false);
    });
});
