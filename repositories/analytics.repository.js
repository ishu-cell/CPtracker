// repositories/analytics.repository.js — Database queries for analytics computations
import { pool } from '../config/database.js';

export const AnalyticsRepository = {
  // ═══════════════════════════════════════════════
  // RATING HISTORY
  // ═══════════════════════════════════════════════

  async getRatingHistory(userId) {
    const [rows] = await pool.query(
      `SELECT cp.contest_id, c.name as contest_name, c.type as contest_type,
              cp.old_rating, cp.new_rating, cp.rating_change, cp.rank_in_contest,
              cp.contest_time
       FROM cf_contest_participation cp
       LEFT JOIN cf_contests c ON cp.contest_id = c.id
       WHERE cp.user_id = ?
       ORDER BY cp.contest_time ASC`,
      [userId]
    );
    return rows;
  },

  async getRatingStats(userId) {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) as total_contests,
         MAX(new_rating) as max_rating,
         AVG(rating_change) as avg_rating_change,
         SUM(rating_change > 0) as positive_contests,
         SUM(rating_change < 0) as negative_contests,
         SUM(rating_change = 0) as neutral_contests
       FROM cf_contest_participation
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  },

  async getBestWorstContest(userId) {
    const [best] = await pool.query(
      `SELECT cp.*, c.name as contest_name FROM cf_contest_participation cp
       LEFT JOIN cf_contests c ON cp.contest_id = c.id
       WHERE cp.user_id = ? ORDER BY cp.rating_change DESC LIMIT 1`,
      [userId]
    );
    const [worst] = await pool.query(
      `SELECT cp.*, c.name as contest_name FROM cf_contest_participation cp
       LEFT JOIN cf_contests c ON cp.contest_id = c.id
       WHERE cp.user_id = ? ORDER BY cp.rating_change ASC LIMIT 1`,
      [userId]
    );
    return { best: best[0] || null, worst: worst[0] || null };
  },

  // ═══════════════════════════════════════════════
  // TAG DISTRIBUTION
  // ═══════════════════════════════════════════════

  async getTagDistribution(userId) {
    // Aggregate problems solved/attempted per tag from the denormalized table
    const [rows] = await pool.query(
      `SELECT 
         tag,
         COUNT(*) as total,
         SUM(ups.status = 'solved') as solved,
         SUM(ups.status = 'attempted') as attempted,
         ROUND(SUM(ups.status = 'solved') / COUNT(*) * 100, 1) as success_rate,
         ROUND(AVG(CASE WHEN ups.status = 'solved' THEN ups.problem_rating END), 0) as avg_rating_solved,
         MAX(CASE WHEN ups.status = 'solved' THEN ups.problem_rating END) as max_rating_solved
       FROM cf_user_problem_status ups
       CROSS JOIN JSON_TABLE(ups.problem_tags, '$[*]' COLUMNS(tag VARCHAR(100) PATH '$')) jt
       WHERE ups.user_id = ? AND ups.problem_tags IS NOT NULL
       GROUP BY tag
       ORDER BY total DESC`,
      [userId]
    );
    return rows;
  },

  // ═══════════════════════════════════════════════
  // RATING DISTRIBUTION (by difficulty buckets)
  // ═══════════════════════════════════════════════

  async getRatingDistribution(userId) {
    const [rows] = await pool.query(
      `SELECT
         CASE 
           WHEN problem_rating < 800 THEN '0-799'
           WHEN problem_rating BETWEEN 800 AND 999 THEN '800-999'
           WHEN problem_rating BETWEEN 1000 AND 1199 THEN '1000-1199'
           WHEN problem_rating BETWEEN 1200 AND 1399 THEN '1200-1399'
           WHEN problem_rating BETWEEN 1400 AND 1599 THEN '1400-1599'
           WHEN problem_rating BETWEEN 1600 AND 1799 THEN '1600-1799'
           WHEN problem_rating BETWEEN 1800 AND 1999 THEN '1800-1999'
           WHEN problem_rating BETWEEN 2000 AND 2199 THEN '2000-2199'
           WHEN problem_rating BETWEEN 2200 AND 2399 THEN '2200-2399'
           WHEN problem_rating >= 2400 THEN '2400+'
           ELSE 'Unrated'
         END as range_label,
         MIN(problem_rating) as range_min,
         COUNT(*) as total,
         SUM(status = 'solved') as solved,
         SUM(status = 'attempted') as attempted
       FROM cf_user_problem_status
       WHERE user_id = ? AND problem_rating IS NOT NULL
       GROUP BY range_label
       ORDER BY MIN(problem_rating) ASC`,
      [userId]
    );
    return rows;
  },

  // ═══════════════════════════════════════════════
  // SUBMISSION HEATMAP
  // ═══════════════════════════════════════════════

  async getHeatmapData(userId, year) {
    const targetYear = year || new Date().getFullYear();
    // Convert unix timestamps to dates and count submissions per day
    const [rows] = await pool.query(
      `SELECT 
         DATE(FROM_UNIXTIME(creation_time_seconds)) as date,
         COUNT(*) as submissions
       FROM cf_submissions
       WHERE user_id = ? 
         AND YEAR(FROM_UNIXTIME(creation_time_seconds)) = ?
       GROUP BY date
       ORDER BY date ASC`,
      [userId, targetYear]
    );
    return { year: targetYear, data: rows };
  },

  // ═══════════════════════════════════════════════
  // WEEKLY SUMMARY
  // ═══════════════════════════════════════════════

  async getWeeklySummary(userId, weeks = 4) {
    const [rows] = await pool.query(
      `SELECT
         DATE(DATE_SUB(FROM_UNIXTIME(creation_time_seconds), INTERVAL WEEKDAY(FROM_UNIXTIME(creation_time_seconds)) DAY)) as week_start,
         COUNT(DISTINCT CONCAT(contest_id, '-', problem_index)) as unique_problems,
         SUM(verdict = 'OK') as accepted,
         COUNT(*) as total_submissions,
         ROUND(AVG(CASE WHEN verdict = 'OK' THEN problem_rating END), 0) as avg_difficulty
       FROM cf_submissions
       WHERE user_id = ? 
         AND creation_time_seconds >= UNIX_TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL ? WEEK))
       GROUP BY week_start
       ORDER BY week_start DESC
       LIMIT ?`,
      [userId, weeks, weeks]
    );
    return rows;
  },

  // ═══════════════════════════════════════════════
  // LANGUAGE DISTRIBUTION
  // ═══════════════════════════════════════════════

  async getLanguageDistribution(userId) {
    const [rows] = await pool.query(
      `SELECT programming_language, COUNT(*) as count
       FROM cf_submissions
       WHERE user_id = ? AND programming_language IS NOT NULL
       GROUP BY programming_language
       ORDER BY count DESC
       LIMIT 10`,
      [userId]
    );
    return rows;
  },

  // ═══════════════════════════════════════════════
  // VERDICT DISTRIBUTION
  // ═══════════════════════════════════════════════

  async getVerdictDistribution(userId) {
    const [rows] = await pool.query(
      `SELECT verdict, COUNT(*) as count
       FROM cf_submissions
       WHERE user_id = ? AND verdict IS NOT NULL
       GROUP BY verdict
       ORDER BY count DESC`,
      [userId]
    );
    return rows;
  },
};
