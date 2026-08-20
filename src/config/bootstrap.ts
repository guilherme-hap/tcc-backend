import 'dotenv/config';
import type { Express } from 'express';
import mysql from 'mysql2/promise';
import { AppDataSource } from './data-source.js';

export async function bootstrap(app: Express, port: number | string) {
    try {
        const dbHost = process.env.DB_HOST || 'localhost';
        const dbPort = Number(process.env.DB_PORT) || 3306;
        const dbUser = process.env.DB_USER || 'root';
        const dbPassword = process.env.DB_PASSWORD || 'root';
        const dbName = process.env.DB_NAME || 'tcc_db';

        const connection = await mysql.createConnection({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        await connection.end();

        await AppDataSource.initialize();
        console.log('Data Source initialized successfully');

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Failed to initialize application:', error);
        process.exit(1);
    }
}
