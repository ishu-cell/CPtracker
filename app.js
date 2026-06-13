// app.js — Express application factory
// Creates and configures the Express app, registers all middleware and routes.
// Does NOT call app.listen() — that's server.js's job.

import express from 'express';
import { clerkMiddleware } from '@clerk/express';
import { errorHandler } from './middleware/errorHandler.js';
import problemsRoutes from './routes/problems.routes.js';
import codeforcesRoutes from './routes/codeforces.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import weaknessRoutes from './routes/weakness.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import trainingRoutes from './routes/training.routes.js';

const app = express();

// ── Global Middleware ──
app.use(clerkMiddleware());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// ── API Routes ──
app.use('/api/problems', problemsRoutes);
app.use('/api/codeforces', codeforcesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/weaknesses', weaknessRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/training', trainingRoutes);

// ── Health Check ──
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── Global Error Handler (must be last) ──
app.use(errorHandler);

export default app;
