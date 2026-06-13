// controllers/weakness.controller.js — Request handler for /api/weaknesses
import { WeaknessService } from '../services/weakness.service.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { createError } from '../middleware/errorHandler.js';

export const WeaknessController = {
  async get(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);
      if (!profile) throw createError(404, 'No Codeforces profile linked.');

      const analysis = await WeaknessService.getWeaknessAnalysis(req.userId);
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  },

  /** POST /api/weaknesses/rebuild — manually recalculate weakness scores */
  async rebuild(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);
      if (!profile) throw createError(404, 'No Codeforces profile linked.');

      await WeaknessService.rebuildTagStats(req.userId);
      const analysis = await WeaknessService.getWeaknessAnalysis(req.userId);
      res.json({ message: 'Weakness scores recalculated.', ...analysis });
    } catch (error) {
      next(error);
    }
  },
};
