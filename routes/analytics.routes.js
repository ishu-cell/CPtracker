// routes/analytics.routes.js — Route definitions for /api/analytics
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { AnalyticsController } from '../controllers/analytics.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/rating-history',       AnalyticsController.ratingHistory);
router.get('/tag-distribution',     AnalyticsController.tagDistribution);
router.get('/rating-distribution',  AnalyticsController.ratingDistribution);
router.get('/heatmap',              AnalyticsController.heatmap);
router.get('/weekly-summary',       AnalyticsController.weeklySummary);
router.get('/verdicts',             AnalyticsController.verdicts);
router.get('/languages',            AnalyticsController.languages);

export default router;
