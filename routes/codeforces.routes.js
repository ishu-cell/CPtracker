// routes/codeforces.routes.js — Route definitions for /api/codeforces
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CodeforcesController } from '../controllers/codeforces.controller.js';

const router = Router();

// All Codeforces routes require authentication
router.use(requireAuth);

router.post('/connect',    CodeforcesController.connect);
router.get('/profile',     CodeforcesController.getProfile);
router.post('/sync',       CodeforcesController.sync);
router.delete('/disconnect', CodeforcesController.disconnect);

export default router;
