import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['tests/unit/**/*.test.ts'],
                    env: {
                        CREDENTIALS_KEY: Buffer.alloc(32, 7).toString('base64'),
                        JWT_SECRET: 'test-secret',
                    },
                },
            },
            {
                test: {
                    name: 'integration',
                    include: ['tests/integration/**/*.test.ts'],
                    globalSetup: ['tests/integration/globalSetup.ts'],
                    setupFiles: ['tests/integration/setup.ts'],
                    fileParallelism: false,
                    testTimeout: 20_000,
                    env: {
                        DB_NAME: 'specping_test',
                        DB_AUTO_CREATE: 'false',
                        CREDENTIALS_KEY: Buffer.alloc(32, 7).toString('base64'),
                        JWT_SECRET: 'test-secret',
                        BCRYPT_SALT_ROUNDS: '4',
                        PUBLIC_DEPLOYMENT: 'false',
                    },
                },
            },
        ],
    },
});
