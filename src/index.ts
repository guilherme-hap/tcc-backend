import 'dotenv/config';
import express from 'express';
import evaluationRoutes from './routes/evaluation.routes.js';
import { setupSwagger } from './config/swagger.js';
import { bootstrap } from './config/bootstrap.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { registerWorkers } from './workers/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/evaluate', evaluationRoutes);

app.use(errorHandler);

setupSwagger(app);

registerWorkers();

bootstrap(app, PORT);
