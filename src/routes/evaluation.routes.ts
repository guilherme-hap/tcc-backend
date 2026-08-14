import { Router } from 'express';
import { EvaluationController } from '../controllers/EvaluationController.js';

const router = Router();
const evaluationController = new EvaluationController();

router.post('/contract', evaluationController.evaluateContract);

export default router;
