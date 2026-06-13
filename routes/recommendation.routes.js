// routes/recommendation.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { RecommendationController } from '../controllers/recommendation.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', RecommendationController.get);
router.get('/by-tag', RecommendationController.byTag);

export default router;
