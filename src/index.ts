import express, { Request, Response } from 'express';
import evaluationRoutes from './routes/evaluation.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/evaluate', evaluationRoutes);

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', message: 'TCC Backend is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
