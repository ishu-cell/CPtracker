// routes/weakness.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { WeaknessController } from '../controllers/weakness.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/',        WeaknessController.get);
router.post('/rebuild', WeaknessController.rebuild);

export default router;
