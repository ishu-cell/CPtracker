// controllers/recommendation.controller.js — Request handler for /api/recommendations
import { RecommendationService } from '../services/recommendation.service.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { createError } from '../middleware/errorHandler.js';
import { RECOMMENDATION } from '../config/constants.js';

export const RecommendationController = {
  async get(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);
      if (!profile) throw createError(404, 'No Codeforces profile linked.');

      const count = Math.min(
        parseInt(req.query.count) || RECOMMENDATION.DEFAULT_COUNT,
        RECOMMENDATION.MAX_COUNT
      );
      const mode = req.query.mode || 'balanced';
      const validModes = Object.keys(RECOMMENDATION.WEIGHTS);
      if (!validModes.includes(mode)) {
        throw createError(400, `Invalid mode. Valid: ${validModes.join(', ')}`);
      }

      const result = await RecommendationService.getRecommendations(req.userId, count, mode);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /** GET /api/recommendations/by-tag?tag=dp&count=10 */
  async byTag(req, res, next) {
    try {
      const profile = await CodeforcesRepository.findProfileByUser(req.userId);
      if (!profile) throw createError(404, 'No Codeforces profile linked.');

      const tag = req.query.tag;
      if (!tag) throw createError(400, 'Missing "tag" query parameter.');

      const count = Math.min(parseInt(req.query.count) || 12, 30);
      const userRating = profile.cf_rating || 1200;

      const solvedSet = await CodeforcesRepository.getSolvedProblemIds(req.userId);

      // Wide range: [rating-100, rating+400] — includes warmup + stretch
      const { pool } = await import('../config/database.js');
      const rangeLow = userRating - 100;
      const rangeHigh = userRating + 400;

      const [candidates] = await pool.query(
        `SELECT contest_id, problem_index, name, rating, tags, solved_count
         FROM cf_problems
         WHERE rating BETWEEN ? AND ?
           AND rating IS NOT NULL
           AND JSON_CONTAINS(tags, ?)
         ORDER BY RAND()
         LIMIT ?`,
        [rangeLow, rangeHigh, JSON.stringify(tag), count * 4]
      );

      // Filter out solved, tag with difficulty tier
      const problems = [];
      for (const p of candidates) {
        if (problems.length >= count) break;
        const pid = `${p.contest_id}-${p.problem_index}`;
        if (solvedSet.has(pid)) continue;

        const tags = typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []);

        // Classify difficulty tier
        let tier = 'target';
        if (p.rating < userRating) tier = 'warmup';
        else if (p.rating >= userRating + 200) tier = 'stretch';

        problems.push({
          contest_id: p.contest_id,
          problem_index: p.problem_index,
          name: p.name,
          rating: p.rating,
          tags,
          solved_count: p.solved_count,
          tier,
          url: `https://codeforces.com/problemset/problem/${p.contest_id}/${p.problem_index}`,
        });
      }

      // Sort: warmup first, then target, then stretch
      const tierOrder = { warmup: 0, target: 1, stretch: 2 };
      problems.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier] || a.rating - b.rating);

      res.json({
        tag,
        user_rating: userRating,
        range: `${rangeLow}-${rangeHigh}`,
        problems,
      });
    } catch (error) {
      next(error);
    }
  },
};
