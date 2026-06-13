// controllers/analytics.controller.js — Request handlers for /api/analytics
import { AnalyticsRepository } from '../repositories/analytics.repository.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { createError } from '../middleware/errorHandler.js';

export const AnalyticsController = {
  /**
   * GET /api/analytics/rating-history
   * Returns full contest history with computed stats.
   */
  async ratingHistory(req, res, next) {
    try {
      await ensureProfile(req.userId);

      const [history, stats, bestWorst] = await Promise.all([
        AnalyticsRepository.getRatingHistory(req.userId),
        AnalyticsRepository.getRatingStats(req.userId),
        AnalyticsRepository.getBestWorstContest(req.userId),
      ]);

      // Get current rating from profile
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);

      res.json({
        history,
        stats: {
          total_contests: Number(stats.total_contests) || 0,
          current_rating: profile?.cf_rating || 0,
          max_rating: profile?.cf_max_rating || stats.max_rating || 0,
          avg_rating_change: stats.avg_rating_change ? parseFloat(Number(stats.avg_rating_change).toFixed(1)) : 0,
          positive_contests: Number(stats.positive_contests) || 0,
          negative_contests: Number(stats.negative_contests) || 0,
          win_rate_percent: Number(stats.total_contests) > 0
            ? parseFloat((Number(stats.positive_contests) / Number(stats.total_contests) * 100).toFixed(1))
            : 0,
          best_contest: bestWorst.best ? {
            contest_id: bestWorst.best.contest_id,
            contest_name: bestWorst.best.contest_name,
            change: bestWorst.best.rating_change,
          } : null,
          worst_contest: bestWorst.worst ? {
            contest_id: bestWorst.worst.contest_id,
            contest_name: bestWorst.worst.contest_name,
            change: bestWorst.worst.rating_change,
          } : null,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/tag-distribution
   */
  async tagDistribution(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const tags = await AnalyticsRepository.getTagDistribution(req.userId);
      res.json({ tags });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/rating-distribution
   */
  async ratingDistribution(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const buckets = await AnalyticsRepository.getRatingDistribution(req.userId);
      res.json({ buckets });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/heatmap?year=2026
   */
  async heatmap(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const data = await AnalyticsRepository.getHeatmapData(req.userId, year);
      res.json(data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/weekly-summary
   */
  async weeklySummary(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const weeks = await AnalyticsRepository.getWeeklySummary(req.userId);
      res.json({ weeks });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/verdicts
   */
  async verdicts(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const verdicts = await AnalyticsRepository.getVerdictDistribution(req.userId);
      res.json({ verdicts });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/analytics/languages
   */
  async languages(req, res, next) {
    try {
      await ensureProfile(req.userId);
      const languages = await AnalyticsRepository.getLanguageDistribution(req.userId);
      res.json({ languages });
    } catch (error) {
      next(error);
    }
  },
};

/**
 * Helper: ensure the user has a linked CF profile.
 */
async function ensureProfile(userId) {
  const profile = await CodeforcesRepository.findProfileByUser(userId);
  if (!profile) {
    throw createError(404, 'No Codeforces profile linked. Connect your handle first.');
  }
  return profile;
}
