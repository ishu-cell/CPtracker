// services/training.service.js — Daily Training Challenge System
import { pool } from '../config/database.js';
import { CodeforcesRepository } from '../repositories/codeforces.repository.js';
import { TRAINING, RECOMMENDATION } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export const TrainingService = {
  /**
   * Get or generate today's challenge for a user.
   */
  async getTodayChallenge(userId, mode = 'medium') {
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have a challenge for today
    const [existing] = await pool.query(
      'SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ?',
      [userId, today]
    );

    if (existing.length > 0) return existing[0];

    // Generate a new challenge
    return this.generateChallenge(userId, today, mode);
  },

  async generateChallenge(userId, date, mode) {
    const profile = await CodeforcesRepository.findProfileByUser(userId);
    if (!profile) throw new Error('No CF profile linked.');

    const userRating = profile.cf_rating || 1200;
    const offset = RECOMMENDATION.DIFFICULTY_OFFSETS[mode] || RECOMMENDATION.DIFFICULTY_OFFSETS.medium;
    const targetRating = userRating + offset;

    // Get weakest tag
    const [weakTags] = await pool.query(
      'SELECT tag FROM cf_tag_stats WHERE user_id = ? ORDER BY weakness_score DESC LIMIT 3',
      [userId]
    );
    const targetTag = weakTags.length > 0 ? weakTags[Math.floor(Math.random() * weakTags.length)].tag : null;

    // Get solved problems to exclude
    const solvedSet = await CodeforcesRepository.getSolvedProblemIds(userId);

    // Find a candidate problem
    let query = `SELECT contest_id, problem_index, name, rating, tags FROM cf_problems WHERE rating BETWEEN ? AND ? AND rating IS NOT NULL`;
    const params = [targetRating - 200, targetRating + 200];

    if (targetTag) {
      query += ` AND JSON_CONTAINS(tags, ?)`;
      params.push(JSON.stringify(targetTag));
    }

    query += ` ORDER BY RAND() LIMIT 20`;
    const [candidates] = await pool.query(query, params);

    // Pick the first unsolved
    let chosen = null;
    for (const c of candidates) {
      const pid = `${c.contest_id}-${c.problem_index}`;
      if (!solvedSet.has(pid)) { chosen = c; break; }
    }

    if (!chosen && candidates.length > 0) {
      chosen = candidates[0]; // Fallback
    }

    if (!chosen) {
      // Broaden search
      const [broad] = await pool.query(
        'SELECT contest_id, problem_index, name, rating, tags FROM cf_problems WHERE rating BETWEEN ? AND ? ORDER BY RAND() LIMIT 1',
        [targetRating - 400, targetRating + 400]
      );
      chosen = broad[0] || null;
    }

    if (!chosen) return null;

    const tags = typeof chosen.tags === 'string' ? JSON.parse(chosen.tags) : (chosen.tags || []);

    const [result] = await pool.query(
      `INSERT INTO daily_challenges (user_id, challenge_date, contest_id, problem_index, problem_name, problem_rating, problem_tags, target_tag, difficulty_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, date, chosen.contest_id, chosen.problem_index, chosen.name, chosen.rating, JSON.stringify(tags), targetTag, mode]
    );

    return {
      id: result.insertId,
      user_id: userId,
      challenge_date: date,
      contest_id: chosen.contest_id,
      problem_index: chosen.problem_index,
      problem_name: chosen.name,
      problem_rating: chosen.rating,
      problem_tags: tags,
      target_tag: targetTag,
      difficulty_mode: mode,
      status: 'pending',
    };
  },

  /**
   * Mark today's challenge as solved and update streak.
   */
  async completeTodayChallenge(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [result] = await pool.query(
      `UPDATE daily_challenges SET status = 'solved', solved_at = CURRENT_TIMESTAMP WHERE user_id = ? AND challenge_date = ? AND status = 'pending'`,
      [userId, today]
    );

    if (result.affectedRows === 0) {
      throw new Error('No pending challenge for today.');
    }

    // Update streak
    await this.updateStreak(userId);

    return { message: 'Challenge completed! 🎉' };
  },

  /**
   * Update the user's training streak.
   */
  async updateStreak(userId) {
    const today = new Date().toISOString().split('T')[0];

    const [existing] = await pool.query(
      'SELECT * FROM training_streaks WHERE user_id = ?',
      [userId]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO training_streaks (user_id, current_streak, longest_streak, last_active_date, total_problems_solved, total_practice_days) VALUES (?, 1, 1, ?, 1, 1)`,
        [userId, today]
      );
      return;
    }

    const streak = existing[0];
    const lastActive = streak.last_active_date ? new Date(streak.last_active_date).toISOString().split('T')[0] : null;

    if (lastActive === today) return; // Already counted today

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let newStreak = lastActive === yesterday ? streak.current_streak + 1 : 1;
    const longestStreak = Math.max(streak.longest_streak, newStreak);

    await pool.query(
      `UPDATE training_streaks SET current_streak = ?, longest_streak = ?, last_active_date = ?, total_problems_solved = total_problems_solved + 1, total_practice_days = total_practice_days + 1 WHERE user_id = ?`,
      [newStreak, longestStreak, today, userId]
    );
  },

  /**
   * Get streak info.
   */
  async getStreak(userId) {
    const [rows] = await pool.query('SELECT * FROM training_streaks WHERE user_id = ?', [userId]);
    return rows[0] || { current_streak: 0, longest_streak: 0, total_problems_solved: 0, total_practice_days: 0 };
  },

  /**
   * Get challenge calendar for a month.
   */
  async getCalendar(userId, month) {
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(
      `SELECT challenge_date, problem_name, problem_rating, status, difficulty_mode FROM daily_challenges WHERE user_id = ? AND challenge_date LIKE ? ORDER BY challenge_date ASC`,
      [userId, `${targetMonth}%`]
    );
    return rows;
  },
};
