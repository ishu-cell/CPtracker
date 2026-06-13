// controllers/training.controller.js
import { TrainingService } from '../services/training.service.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { createError } from '../middleware/errorHandler.js';

export const TrainingController = {
  async today(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);
      if (!profile) throw createError(404, 'No CF profile linked.');
      const mode = req.query.mode || 'medium';
      const challenge = await TrainingService.getTodayChallenge(req.userId, mode);
      const streak = await TrainingService.getStreak(req.userId);
      res.json({ challenge, streak });
    } catch (error) { next(error); }
  },

  async complete(req, res, next) {
    try {
      const result = await TrainingService.completeTodayChallenge(req.userId);
      const streak = await TrainingService.getStreak(req.userId);
      res.json({ ...result, streak });
    } catch (error) { next(error); }
  },

  async calendar(req, res, next) {
    try {
      const month = req.query.month;
      const days = await TrainingService.getCalendar(req.userId, month);
      const streak = await TrainingService.getStreak(req.userId);
      res.json({ days, streak });
    } catch (error) { next(error); }
  },
};
