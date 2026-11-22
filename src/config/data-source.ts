import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Evaluation } from '../entities/Evaluation.js';
import { EvaluationJob } from '../entities/EvaluationJob.js';
import { User } from '../entities/User.js';
import { SavedApi } from '../entities/SavedApi.js';
import { CustomRule } from '../entities/CustomRule.js';
import { dbConnection } from './database.js';
import { Baseline1795305307365 } from '../migrations/1795305307365-Baseline.js';
import { AddUserTokenVersion1795305307366 } from '../migrations/1795305307366-AddUserTokenVersion.js';
import { EncryptSavedApiHeaders1795305307367 } from '../migrations/1795305307367-EncryptSavedApiHeaders.js';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: dbConnection.host,
    port: dbConnection.port,
    username: dbConnection.user,
    password: dbConnection.password,
    database: dbConnection.database,
    synchronize: false,
    logging: process.env.DB_LOGGING ? process.env.DB_LOGGING === 'true' : false,
    entities: [Evaluation, EvaluationJob, User, SavedApi, CustomRule],
    migrations: [Baseline1795305307365, AddUserTokenVersion1795305307366, EncryptSavedApiHeaders1795305307367],
    subscribers: [],
});
