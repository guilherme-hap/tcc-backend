import { afterAll, beforeAll, beforeEach } from 'vitest';
import { AppDataSource } from '../../src/config/data-source.js';

beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    await AppDataSource.runMigrations();
});

beforeEach(async () => {
    await AppDataSource.query('TRUNCATE evaluation_jobs, evaluations, saved_apis, custom_rules, users CASCADE');
});

afterAll(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
});
