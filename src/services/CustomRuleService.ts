import { AppDataSource } from '../config/data-source.js';
import { CustomRule } from '../entities/CustomRule.js';
import { AppError } from '../errors/AppError.js';

export class CustomRuleService {
    private get repository() {
        return AppDataSource.getRepository(CustomRule);
    }

    async create(
        userId: string,
        data: {
            name: string;
            rulesConfig: Record<string, boolean>;
            severityWeights?: Record<string, number>;
        },
    ): Promise<CustomRule> {
        const customRule = this.repository.create({
            userId,
            name: data.name,
            rulesConfig: data.rulesConfig,
            severityWeights: data.severityWeights ?? null,
        });
        return this.repository.save(customRule);
    }

    async listByUser(userId: string): Promise<CustomRule[]> {
        return this.repository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async findByIdAndUser(id: string, userId: string): Promise<CustomRule> {
        const customRule = await this.repository.findOneBy({ id, userId });
        if (!customRule) {
            throw new AppError('Custom rule not found', 404);
        }
        return customRule;
    }

    async update(
        id: string,
        userId: string,
        data: Partial<{
            name: string;
            rulesConfig: Record<string, boolean>;
            severityWeights: Record<string, number> | null;
        }>,
    ): Promise<CustomRule> {
        const customRule = await this.findByIdAndUser(id, userId);

        if (data.name !== undefined) customRule.name = data.name;
        if (data.rulesConfig !== undefined) customRule.rulesConfig = data.rulesConfig;
        if (data.severityWeights !== undefined) customRule.severityWeights = data.severityWeights;

        return this.repository.save(customRule);
    }

    async delete(id: string, userId: string): Promise<void> {
        const result = await this.repository.delete({ id, userId });
        if (result.affected === 0) {
            throw new AppError('Custom rule not found', 404);
        }
    }
}
