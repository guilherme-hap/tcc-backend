import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import evaluationRoutes from './routes/evaluation.routes.js';
import authRoutes from './routes/auth.routes.js';
import savedApiRoutes from './routes/savedApi.routes.js';
import customRuleRoutes from './routes/customRule.routes.js';
import { setupSwagger } from './config/swagger.js';
import { bootstrap } from './config/bootstrap.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({ origin: allowedOrigins }));

app.use(express.json());

app.use('/api/evaluations', evaluationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user/apis', savedApiRoutes);
app.use('/api/user/rules', customRuleRoutes);

app.use(errorHandler);

setupSwagger(app);

bootstrap(app, PORT);
