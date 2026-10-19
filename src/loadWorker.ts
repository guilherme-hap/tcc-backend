import 'dotenv/config';
import { setProcessRole } from './config/processRole.js';

process.env.DB_SYNCHRONIZE = 'false';
process.env.DB_AUTO_CREATE = 'false';
setProcessRole('load-worker');

try {
    await import('./config/zod.js');
    const { AppDataSource } = await import('./config/data-source.js');
    const { registerWorkers } = await import('./workers/index.js');

    await AppDataSource.initialize();
    console.log('Data Source initialized successfully');

    await registerWorkers('load-worker');
    console.log('Load worker registered successfully');
} catch (error) {
    console.error('Failed to initialize the load worker:', error);
    process.exit(1);
}
