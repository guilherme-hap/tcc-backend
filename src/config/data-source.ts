import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationJob } from '../entities/EvaluationJob.js';
import { User } from '../entities/User.js';
import { SavedApi } from '../entities/SavedApi.js';
import { CustomRule } from '../entities/CustomRule.js';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'tcc_db',
    synchronize: process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true,
    logging: process.env.DB_LOGGING ? process.env.DB_LOGGING === 'true' : false,
    entities: [Evaluation, EvaluationJob, User, SavedApi, CustomRule],
    migrations: [],
    subscribers: [],
});
