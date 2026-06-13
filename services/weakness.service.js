// services/weakness.service.js — Weakness Detection Engine
// Analyzes user's tag statistics to identify weak, neglected, and over-practiced topics.

import { pool } from '../config/database.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { logger } from '../utils/logger.js';

export const WeaknessService = {
  /**
   * Rebuild cf_tag_stats for a user from their submissions.
   * Called after sync. Pre-computes all tag-level statistics.
   */
  async rebuildTagStats(userId) {
    // Clear existing stats
    await pool.query('DELETE FROM cf_tag_stats WHERE user_id = ?', [userId]);

    // Aggregate from cf_user_problem_status (already denormalized)
    const query = `
      INSERT INTO cf_tag_stats 
        (user_id, tag, total_attempted, total_solved, success_rate,
         avg_rating_solved, max_rating_solved, avg_attempts_to_solve, last_practiced_at)
      SELECT
        ups.user_id,
        jt.tag,
        COUNT(*) as total_attempted,
        SUM(ups.status = 'solved') as total_solved,
        ROUND(SUM(ups.status = 'solved') / COUNT(*) * 100, 2) as success_rate,
        ROUND(AVG(CASE WHEN ups.status = 'solved' THEN ups.problem_rating END), 2) as avg_rating_solved,
        MAX(CASE WHEN ups.status = 'solved' THEN ups.problem_rating END) as max_rating_solved,
        ROUND(AVG(ups.total_attempts), 2) as avg_attempts_to_solve,
        MAX(ups.first_attempt_time) as last_practiced_at
      FROM cf_user_problem_status ups
      CROSS JOIN JSON_TABLE(ups.problem_tags, '$[*]' COLUMNS(tag VARCHAR(100) PATH '$')) jt
      WHERE ups.user_id = ? AND ups.problem_tags IS NOT NULL
      GROUP BY ups.user_id, jt.tag
    `;
    await pool.query(query, [userId]);

    // Now compute weakness scores for each tag
    await this.computeWeaknessScores(userId);

    logger.info(`Rebuilt tag stats for user ${userId}`);
  },

  /**
   * Compute weakness score for each tag.
   * 
   * Formula:
   *   weakness_score = (1 - success_rate/100) × 4
   *                  + (1 - min(avg_rating_solved / user_rating, 1)) × 3
   *                  + freshness_penalty × 2
   *                  + volume_bonus × 1
   * 
   * Higher score = weaker topic (needs more practice).
   * Score range: 0-10.
   */
  async computeWeaknessScores(userId) {
    const profile = await CodeforcesRepository.findProfileByUser(userId);
    const userRating = profile?.cf_rating || 1200;

    const [tags] = await pool.query(
      'SELECT * FROM cf_tag_stats WHERE user_id = ?',
      [userId]
    );

    const now = Date.now() / 1000; // Current time in unix seconds

    for (const tag of tags) {
      // Factor 1: Low success rate (0-4 points)
      // Lower success rate = higher weakness
      const failureFactor = (1 - (tag.success_rate / 100)) * 4;

      // Factor 2: Solving below user rating (0-3 points)
      // If avg solved rating is much lower than user rating, it means they avoid hard problems in this tag
      let difficultyFactor = 0;
      if (tag.avg_rating_solved && userRating > 0) {
        const ratio = Math.min(tag.avg_rating_solved / userRating, 1);
        difficultyFactor = (1 - ratio) * 3;
      } else {
        difficultyFactor = 3; // No solved problems = max weakness signal
      }

      // Factor 3: Not practiced recently (0-2 points)
      let freshnessPenalty = 0;
      if (tag.last_practiced_at) {
        const daysSince = (now - tag.last_practiced_at) / (24 * 60 * 60);
        freshnessPenalty = Math.min(2, daysSince / 30); // Max penalty after 30 days
      } else {
        freshnessPenalty = 2;
      }

      // Factor 4: Low volume attempted (0-1 points)
      // If fewer than 5 problems attempted, full bonus
      const volumeBonus = tag.total_attempted < 5 ? 1 : 
                          tag.total_attempted < 10 ? 0.5 : 0;

      const weaknessScore = Math.min(10, 
        Math.round((failureFactor + difficultyFactor + freshnessPenalty + volumeBonus) * 100) / 100
      );

      await pool.query(
        'UPDATE cf_tag_stats SET weakness_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [weaknessScore, tag.id]
      );
    }
  },

  /**
   * Get full weakness analysis for a user.
   * Returns weaknesses, neglected topics, strengths, and over-practiced areas.
   */
  async getWeaknessAnalysis(userId) {
    const [tags] = await pool.query(
      'SELECT * FROM cf_tag_stats WHERE user_id = ? ORDER BY weakness_score DESC',
      [userId]
    );

    if (tags.length === 0) {
      return { weaknesses: [], neglected: [], strengths: [], overPracticed: [] };
    }

    // Categorize tags
    const weaknesses = [];
    const neglected = [];
    const strengths = [];
    const overPracticed = [];

    for (const tag of tags) {
      const entry = {
        tag: tag.tag,
        weakness_score: parseFloat(tag.weakness_score),
        total_attempted: tag.total_attempted,
        total_solved: tag.total_solved,
        success_rate: parseFloat(tag.success_rate),
        avg_rating_solved: tag.avg_rating_solved ? parseFloat(tag.avg_rating_solved) : null,
        max_rating_solved: tag.max_rating_solved,
        last_practiced_at: tag.last_practiced_at,
      };

      // Neglected: fewer than 3 problems attempted
      if (tag.total_attempted < 3) {
        entry.category = 'neglected';
        entry.recommendation = 'Too few attempts to assess — start practicing this topic.';
        neglected.push(entry);
        continue;
      }

      // Weakness: score >= 5.0 and at least 3 attempts
      if (tag.weakness_score >= 5.0) {
        entry.category = 'critical_weakness';
        entry.recommendation = `High failure rate (${tag.success_rate}%). Focus here for maximum improvement.`;
        weaknesses.push(entry);
        continue;
      }

      if (tag.weakness_score >= 3.0) {
        entry.category = 'moderate_weakness';
        entry.recommendation = 'Room for improvement. Practice problems slightly above your comfort zone.';
        weaknesses.push(entry);
        continue;
      }

      // Strength: success rate >= 70% and at least 10 solved
      if (tag.success_rate >= 70 && tag.total_solved >= 10) {
        entry.category = 'strength';

        // Over-practiced: strength with 50+ solved and nothing else to show for it
        if (tag.total_solved >= 50) {
          entry.category = 'over_practiced';
          entry.recommendation = 'Diminishing returns — shift focus to weaker areas.';
          overPracticed.push(entry);
        } else {
          entry.recommendation = 'Strong topic. Maintain with occasional practice.';
          strengths.push(entry);
        }
        continue;
      }

      // Default: moderate
      if (tag.success_rate >= 60) {
        entry.category = 'moderate';
        entry.recommendation = 'Decent but not strong. Practice at higher difficulty.';
        strengths.push(entry);
      } else {
        entry.category = 'moderate_weakness';
        entry.recommendation = 'Below average success rate. Needs attention.';
        weaknesses.push(entry);
      }
    }

    return { weaknesses, neglected, strengths, overPracticed };
  },
};
