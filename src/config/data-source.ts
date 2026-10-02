import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationJob } from '../entities/EvaluationJob.js';
import { User } from '../entities/User.js';
import { SavedApi } from '../entities/SavedApi.js';
import { CustomRule } from '../entities/CustomRule.js';
import { dbConnection } from './database.js';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: dbConnection.host,
    port: dbConnection.port,
    username: dbConnection.user,
    password: dbConnection.password,
    database: dbConnection.database,
    synchronize: process.env.DB_SYNCHRONIZE ? process.env.DB_SYNCHRONIZE === 'true' : true,
    logging: process.env.DB_LOGGING ? process.env.DB_LOGGING === 'true' : false,
    entities: [Evaluation, EvaluationJob, User, SavedApi, CustomRule],
    migrations: [],
    subscribers: [],
});
