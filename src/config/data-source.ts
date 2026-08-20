import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Evaluation } from '../entities/Evaluation.js';

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'tcc_db',
    synchronize: process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true,
    logging: process.env.DB_LOGGING ? process.env.DB_LOGGING === 'true' : false,
    entities: [Evaluation],
    migrations: [],
    subscribers: [],
});
