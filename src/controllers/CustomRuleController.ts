import { Response } from 'express';
import { CustomRuleService } from '../services/CustomRuleService.js';
import { AppError } from '../errors/AppError.js';
import type { AuthenticatedRequest } from '../middlewares/optionalAuth.js';
import type { Severity } from '../types/severity.js';

const VALID_SEVERITIES: Set<string> = new Set<string>([
    'Error', 'Warning', 'Info', 'Hint', 'Unknown',
] satisfies Severity[]);

function validateRulesConfig(config: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(config)) {
        if (typeof value !== 'boolean') {
            throw new AppError(
                `Invalid value for rule '${key}': expected boolean, got ${typeof value}`,
                400,
            );
        }
    }
}

function validateSeverityWeights(weights: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(weights)) {
        if (!VALID_SEVERITIES.has(key)) {
            throw new AppError(
                `Invalid severity key: '${key}'. Valid keys: Error, Warning, Info, Hint, Unknown`,
                400,
            );
        }
        if (typeof value !== 'number' || value < 0) {
            throw new AppError(
                `Severity weight for '${key}' must be a non-negative number`,
                400,
            );
        }
    }
}

export class CustomRuleController {
    private service: CustomRuleService;

    constructor() {
        this.service = new CustomRuleService();
    }

    public create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { name, rulesConfig, severityWeights } = req.body;

        if (!name || !rulesConfig) {
            throw new AppError('Fields "name" and "rulesConfig" are required', 400);
        }

        if (typeof rulesConfig !== 'object' || Array.isArray(rulesConfig)) {
            throw new AppError('"rulesConfig" must be an object', 400);
        }
        validateRulesConfig(rulesConfig);

        if (severityWeights !== undefined && severityWeights !== null) {
            if (typeof severityWeights !== 'object' || Array.isArray(severityWeights)) {
                throw new AppError('"severityWeights" must be an object', 400);
            }
            validateSeverityWeights(severityWeights);
        }

        const customRule = await this.service.create(req.userId!, {
            name,
            rulesConfig,
            severityWeights: severityWeights ?? undefined,
        });

        res.status(201).json(customRule);
    };

    public list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const customRules = await this.service.listByUser(req.userId!);
        res.status(200).json(customRules);
    };

    public update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { name, rulesConfig, severityWeights } = req.body;

        if (name === undefined && rulesConfig === undefined && severityWeights === undefined) {
            throw new AppError('At least one field must be provided for update', 400);
        }

        if (rulesConfig !== undefined) {
            if (typeof rulesConfig !== 'object' || Array.isArray(rulesConfig)) {
                throw new AppError('"rulesConfig" must be an object', 400);
            }
            validateRulesConfig(rulesConfig);
        }

        if (severityWeights !== undefined && severityWeights !== null) {
            if (typeof severityWeights !== 'object' || Array.isArray(severityWeights)) {
                throw new AppError('"severityWeights" must be an object', 400);
            }
            validateSeverityWeights(severityWeights);
        }

        const data: Record<string, unknown> = {};
        if (name !== undefined) data.name = name;
        if (rulesConfig !== undefined) data.rulesConfig = rulesConfig;
        if (severityWeights !== undefined) data.severityWeights = severityWeights;

        const customRule = await this.service.update(req.params.id as string, req.userId!, data);
        res.status(200).json(customRule);
    };

    public delete = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        await this.service.delete(req.params.id as string, req.userId!);
        res.status(200).json({ message: 'Custom rule deleted successfully' });
    };
}
