// routes/training.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { TrainingController } from '../controllers/training.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/today',          TrainingController.today);
router.post('/today/complete', TrainingController.complete);
router.get('/calendar',       TrainingController.calendar);

export default router;
