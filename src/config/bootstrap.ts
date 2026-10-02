import 'dotenv/config';
import type { Express } from 'express';
import pg from 'pg';
import { AppDataSource } from './data-source.js';
import { dbConnection } from './database.js';
import { registerWorkers } from '../workers/index.js';

export async function bootstrap(app: Express, port: number | string) {
    try {
        const autoCreate = process.env.DB_AUTO_CREATE !== 'false';

        if (autoCreate) {
            const client = new pg.Client({ ...dbConnection, database: 'postgres' });
            await client.connect();
            try {
                await client.query(`CREATE DATABASE "${dbConnection.database}"`);
            } catch (err: any) {
                if (err.code !== '42P04') throw err;
            }
            await client.end();
        }

        await AppDataSource.initialize();
        console.log('Data Source initialized successfully');

        await registerWorkers();
        console.log('Workers registered successfully');

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to initialize application:', error);
        process.exit(1);
    }
}
