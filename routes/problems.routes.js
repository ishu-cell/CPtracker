// routes/problems.routes.js — Route definitions for /api/problems
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ProblemsController } from '../controllers/problems.controller.js';

const router = Router();

// All problem routes require authentication
router.use(requireAuth);

router.get('/', ProblemsController.getAll);
router.post('/', ProblemsController.create);
router.put('/:id', ProblemsController.update);
router.delete('/:id', ProblemsController.remove);

export default router;
