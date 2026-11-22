import { AppDataSource } from '../config/data-source.js';
import { SavedApi } from '../entities/SavedApi.js';
import { AppError } from '../errors/AppError.js';
import type { CreateSavedApiInput, UpdateSavedApiInput } from '../schemas/savedApi.schema.js';
import { isUniqueViolation } from '../utils/isUniqueViolation.js';
import { decryptSettings, encryptSettings } from '../utils/savedApiSettings.js';

export class SavedApiService {
    private get repository() {
        return AppDataSource.getRepository(SavedApi);
    }

    async create(userId: string, data: CreateSavedApiInput): Promise<SavedApi> {
        const savedApi = this.repository.create({
            userId,
            name: data.name,
            openApiUrl: data.openApiUrl,
            apiBaseUrl: data.apiBaseUrl ?? null,
            defaultSettings: encryptSettings(data.defaultSettings ?? null, userId),
        });
        return this.save(savedApi);
    }

    async listByUser(userId: string): Promise<SavedApi[]> {
        const savedApis = await this.repository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
        return savedApis.map((savedApi) => this.withDecryptedSettings(savedApi));
    }

    async update(id: string, userId: string, data: UpdateSavedApiInput): Promise<SavedApi> {
        const savedApi = await this.repository.findOneBy({ id, userId });
        if (!savedApi) {
            throw new AppError('SAVED_API_NOT_FOUND');
        }

        if (data.name !== undefined) savedApi.name = data.name;
        if (data.openApiUrl !== undefined) savedApi.openApiUrl = data.openApiUrl;
        if (data.apiBaseUrl !== undefined) savedApi.apiBaseUrl = data.apiBaseUrl;
        if (data.defaultSettings !== undefined) savedApi.defaultSettings = encryptSettings(data.defaultSettings, userId);

        return this.save(savedApi);
    }

    private withDecryptedSettings(savedApi: SavedApi): SavedApi {
        return { ...savedApi, defaultSettings: decryptSettings(savedApi.defaultSettings, savedApi.userId) };
    }

    private async save(savedApi: SavedApi): Promise<SavedApi> {
        try {
            return this.withDecryptedSettings(await this.repository.save(savedApi));
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError('SAVED_API_ALREADY_EXISTS');
            }
            throw error;
        }
    }

    async delete(id: string, userId: string): Promise<void> {
        const result = await this.repository.delete({ id, userId });
        if (result.affected === 0) {
            throw new AppError('SAVED_API_NOT_FOUND');
        }
    }
}
