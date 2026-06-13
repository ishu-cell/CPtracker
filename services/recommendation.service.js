// services/recommendation.service.js — Problem Recommendation Engine
// Scores unsolved CF problems and returns the top-N most impactful for rating growth.

import { pool } from '../config/database.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { RECOMMENDATION } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export const RecommendationService = {
  /**
   * Get personalized problem recommendations.
   * @param {string} userId
   * @param {number} count - number of problems to return
   * @param {string} mode - 'balanced' | 'weakness_focus' | 'stretch' | 'contest_prep'
   */
  async getRecommendations(userId, count = 10, mode = 'balanced') {
    const profile = await CodeforcesRepository.findProfileByUser(userId);
    if (!profile) throw new Error('No CF profile linked.');

    const userRating = profile.cf_rating || 1200;
    const weights = RECOMMENDATION.WEIGHTS[mode] || RECOMMENDATION.WEIGHTS.balanced;
    const offset = RECOMMENDATION.DIFFICULTY_OFFSETS[mode] || RECOMMENDATION.DIFFICULTY_OFFSETS.medium;
    const targetRating = userRating + offset;

    // 1. Get user's weaknesses (tag → weakness_score)
    const [tagStats] = await pool.query(
      'SELECT tag, weakness_score, last_practiced_at FROM cf_tag_stats WHERE user_id = ?',
      [userId]
    );
    const weaknessMap = new Map(tagStats.map(t => [t.tag, {
      score: parseFloat(t.weakness_score || 0),
      lastPracticed: t.last_practiced_at,
    }]));

    // 2. Get solved problem IDs to exclude
    const solvedSet = await CodeforcesRepository.getSolvedProblemIds(userId);

    // 3. Fetch candidate problems — tight range around user level
    //    For balanced: [rating, rating+200]  For stretch: [rating+100, rating+400]
    const rangeLow = userRating + offset;
    const rangeHigh = userRating + offset + 200;

    const [candidates] = await pool.query(
      `SELECT contest_id, problem_index, name, rating, tags, solved_count
       FROM cf_problems
       WHERE rating BETWEEN ? AND ?
         AND rating IS NOT NULL
       ORDER BY RAND()
       LIMIT ?`,
      [rangeLow, rangeHigh, RECOMMENDATION.CANDIDATE_POOL_SIZE]
    );

    // 4. Score each candidate
    const now = Date.now() / 1000;
    const scored = [];

    for (const p of candidates) {
      const pid = `${p.contest_id}-${p.problem_index}`;

      // Skip already solved
      if (solvedSet.has(pid)) continue;

      const tags = typeof p.tags === 'string' ? JSON.parse(p.tags) : (p.tags || []);

      // D: Difficulty Fit Score (0-100)
      const distance = Math.abs(p.rating - targetRating);
      const D = Math.max(0, 100 - (distance / 5));

      // K: Weakness Alignment Score (0-100)
      let K = 0;
      let primaryWeakTag = null;
      for (const tag of tags) {
        const w = weaknessMap.get(tag);
        if (w && w.score * 10 > K) {
          K = w.score * 10;
          primaryWeakTag = tag;
        }
      }

      // F: Freshness Score (0-100)
      let F = 50; // Default for tags we don't track
      for (const tag of tags) {
        const w = weaknessMap.get(tag);
        if (w && w.lastPracticed) {
          const daysSince = (now - w.lastPracticed) / (24 * 60 * 60);
          const tagFreshness = Math.min(100, daysSince * 2);
          F = Math.max(F, tagFreshness);
        }
      }

      // P: Popularity Score (0-100)
      const P = Math.min(100, (p.solved_count / 1000) * 10);

      // S: Staleness Penalty (0-100)
      // Estimate contest age from contest_id (higher ID = more recent)
      const estimatedAge = Math.max(0, 2000 - p.contest_id) / 200;
      const S = Math.min(100, estimatedAge * 15);

      // Total score
      const totalScore = 
        weights.difficulty * D +
        weights.weakness * K +
        weights.freshness * F +
        weights.popularity * P -
        weights.staleness * S;

      // Build recommendation reason
      let reason = [];
      if (K > 30 && primaryWeakTag) reason.push(`Targets weak area: ${primaryWeakTag}`);
      if (D > 70) reason.push(`Good difficulty match (rating ${p.rating})`);
      if (P > 60) reason.push('Well-tested problem');
      if (F > 80) reason.push('Fresh topic — not practiced recently');

      scored.push({
        contest_id: p.contest_id,
        problem_index: p.problem_index,
        name: p.name,
        rating: p.rating,
        tags,
        solved_count: p.solved_count,
        url: `https://codeforces.com/problemset/problem/${p.contest_id}/${p.problem_index}`,
        score: Math.round(totalScore * 10) / 10,
        recommendation_reason: reason.join('. ') || 'Balanced recommendation for your level',
        primary_weak_tag: primaryWeakTag,
      });
    }

    // 5. Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // 6. Diversify — max N problems per tag
    const result = this._diversify(scored, count, RECOMMENDATION.MAX_PER_TAG);

    return {
      mode,
      user_rating: userRating,
      target_range: `${rangeLow}-${rangeHigh}`,
      primary_weakness: tagStats.length > 0 ? tagStats.reduce((a, b) => a.weakness_score > b.weakness_score ? a : b).tag : null,
      problems: result,
    };
  },

  /**
   * Ensure tag diversity in results.
   * No more than maxPerTag problems sharing the same primary tag.
   */
  _diversify(scored, count, maxPerTag) {
    const result = [];
    const tagCounts = new Map();

    for (const p of scored) {
      if (result.length >= count) break;

      const primaryTag = p.tags[0] || 'other';
      const currentCount = tagCounts.get(primaryTag) || 0;

      if (currentCount >= maxPerTag) continue;

      tagCounts.set(primaryTag, currentCount + 1);
      result.push(p);
    }

    return result;
  },
};
