import { AppDataSource } from '../config/data-source.js';
import { SavedApi } from '../entities/SavedApi.js';
import { AppError } from '../errors/AppError.js';

export class SavedApiService {
    private get repository() {
        return AppDataSource.getRepository(SavedApi);
    }

    async create(
        userId: string,
        data: {
            name: string;
            openApiUrl: string;
            apiBaseUrl?: string;
            defaultSettings?: SavedApi['defaultSettings'];
        },
    ): Promise<SavedApi> {
        const savedApi = this.repository.create({
            userId,
            name: data.name,
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl || null,
            defaultSettings: data.defaultSettings ?? null,
        });
        return this.repository.save(savedApi);
    }

    async listByUser(userId: string): Promise<SavedApi[]> {
        return this.repository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    async findByIdAndUser(id: string, userId: string): Promise<SavedApi> {
        const savedApi = await this.repository.findOneBy({ id, userId });
        if (!savedApi) {
            throw new AppError('Saved API not found', 404);
        }
        return savedApi;
    }

    async update(
        id: string,
        userId: string,
        data: Partial<{
            name: string;
            openApiUrl: string;
            apiBaseUrl: string | null;
            defaultSettings: SavedApi['defaultSettings'];
        }>,
    ): Promise<SavedApi> {
        const savedApi = await this.findByIdAndUser(id, userId);

        if (data.name !== undefined) savedApi.name = data.name;
        if (data.openApiUrl !== undefined) savedApi.openApiUrl = data.openApiUrl;
        if (data.apiBaseUrl !== undefined) savedApi.apiBaseUrl = data.apiBaseUrl;
        if (data.defaultSettings !== undefined) savedApi.defaultSettings = data.defaultSettings;

        return this.repository.save(savedApi);
    }

    async delete(id: string, userId: string): Promise<void> {
        const result = await this.repository.delete({ id, userId });
        if (result.affected === 0) {
            throw new AppError('Saved API not found', 404);
        }
    }
}
