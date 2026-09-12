import 'dotenv/config';
import type { Express } from 'express';
import pg from 'pg';
import { AppDataSource } from './data-source.js';
import { registerWorkers } from '../workers/index.js';

export async function bootstrap(app: Express, port: number | string) {
    try {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = Number(process.env.DB_PORT) || 5432;
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || 'root';
        const dbName = process.env.DB_NAME || 'tcc_db';
        const autoCreate = process.env.DB_AUTO_CREATE !== 'false';

        if (autoCreate) {
            const client = new pg.Client({
                host: dbHost,
                port: dbPort,
                user: dbUser,
                password: dbPassword,
                database: 'postgres',
            });
            await client.connect();
            try {
                await client.query(`CREATE DATABASE "${dbName}"`);
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
