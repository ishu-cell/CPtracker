// repositories/codeforces.repository.js — Database queries for Codeforces tables
import { pool } from '../config/database.js';

export const CodeforcesRepository = {
  // ═══════════════════════════════════════════════
  // PROFILES
  // ═══════════════════════════════════════════════

  async findProfileByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM codeforces_profiles WHERE user_id = ?',
      [userId]
    );
    return rows[0] || null;
  },

  async findProfileByHandle(cfHandle) {
    const [rows] = await pool.query(
      'SELECT * FROM codeforces_profiles WHERE cf_handle = ?',
      [cfHandle]
    );
    return rows[0] || null;
  },

  async createProfile(userId, profileData) {
    const query = `
      INSERT INTO codeforces_profiles 
        (user_id, cf_handle, cf_rating, cf_max_rating, cf_rank, cf_max_rank, 
         cf_avatar, cf_title_photo, cf_contribution, cf_friend_of_count, cf_registration_time,
         sync_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'syncing')
    `;
    const values = [
      userId,
      profileData.handle,
      profileData.rating || 0,
      profileData.maxRating || 0,
      profileData.rank || 'newbie',
      profileData.maxRank || 'newbie',
      profileData.avatar || null,
      profileData.titlePhoto || null,
      profileData.contribution || 0,
      profileData.friendOfCount || 0,
      profileData.registrationTimeSeconds || null,
    ];
    const [result] = await pool.query(query, values);
    return result.insertId;
  },

  async updateProfile(userId, profileData) {
    const query = `
      UPDATE codeforces_profiles SET
        cf_rating = ?, cf_max_rating = ?, cf_rank = ?, cf_max_rank = ?,
        cf_avatar = ?, cf_title_photo = ?, cf_contribution = ?, cf_friend_of_count = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `;
    await pool.query(query, [
      profileData.rating || 0,
      profileData.maxRating || 0,
      profileData.rank || 'newbie',
      profileData.maxRank || 'newbie',
      profileData.avatar || null,
      profileData.titlePhoto || null,
      profileData.contribution || 0,
      profileData.friendOfCount || 0,
      userId,
    ]);
  },

  async updateSyncStatus(userId, status, errorMessage = null) {
    await pool.query(
      `UPDATE codeforces_profiles 
       SET sync_status = ?, sync_error_message = ?, last_synced_at = IF(? = 'idle', CURRENT_TIMESTAMP, last_synced_at), updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [status, errorMessage, status, userId]
    );
  },

  async updateSubmissionCount(userId, count) {
    await pool.query(
      'UPDATE codeforces_profiles SET total_submissions_synced = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [count, userId]
    );
  },

  async deleteProfile(userId) {
    // Delete all user-specific CF data (cascade)
    await pool.query('DELETE FROM cf_submissions WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM cf_user_problem_status WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM cf_contest_participation WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM cf_tag_stats WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM daily_challenges WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM training_streaks WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM user_goals WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM codeforces_profiles WHERE user_id = ?', [userId]);
  },

  // ═══════════════════════════════════════════════
  // CONTESTS
  // ═══════════════════════════════════════════════

  async upsertContest(contest) {
    const query = `
      INSERT INTO cf_contests (id, name, type, phase, duration_seconds, start_time_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name = VALUES(name), phase = VALUES(phase)
    `;
    await pool.query(query, [
      contest.id,
      contest.name,
      contest.type || 'CF',
      contest.phase || null,
      contest.durationSeconds || null,
      contest.startTimeSeconds || null,
    ]);
  },

  // ═══════════════════════════════════════════════
  // CONTEST PARTICIPATION (rating changes)
  // ═══════════════════════════════════════════════

  async upsertContestParticipation(userId, cfHandle, ratingChange) {
    const query = `
      INSERT INTO cf_contest_participation 
        (user_id, contest_id, cf_handle, rank_in_contest, old_rating, new_rating, rating_change, contest_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rank_in_contest = VALUES(rank_in_contest),
        old_rating = VALUES(old_rating),
        new_rating = VALUES(new_rating),
        rating_change = VALUES(rating_change)
    `;
    await pool.query(query, [
      userId,
      ratingChange.contestId,
      cfHandle,
      ratingChange.rank || null,
      ratingChange.oldRating,
      ratingChange.newRating,
      ratingChange.newRating - ratingChange.oldRating,
      ratingChange.ratingUpdateTimeSeconds || null,
    ]);
  },

  async getContestParticipation(userId) {
    const [rows] = await pool.query(
      `SELECT cp.*, c.name as contest_name, c.type as contest_type
       FROM cf_contest_participation cp
       LEFT JOIN cf_contests c ON cp.contest_id = c.id
       WHERE cp.user_id = ?
       ORDER BY cp.contest_time ASC`,
      [userId]
    );
    return rows;
  },

  // ═══════════════════════════════════════════════
  // PROBLEMS (global catalog)
  // ═══════════════════════════════════════════════

  async upsertProblem(problem, solvedCount) {
    const query = `
      INSERT INTO cf_problems (contest_id, problem_index, name, rating, tags, solved_count, problem_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name), rating = VALUES(rating), tags = VALUES(tags),
        solved_count = VALUES(solved_count), updated_at = CURRENT_TIMESTAMP
    `;
    await pool.query(query, [
      problem.contestId || null,
      problem.index,
      problem.name,
      problem.rating || null,
      JSON.stringify(problem.tags || []),
      solvedCount || 0,
      problem.type || 'PROGRAMMING',
    ]);
  },

  async getProblemCount() {
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM cf_problems');
    return rows[0].count;
  },

  // ═══════════════════════════════════════════════
  // SUBMISSIONS
  // ═══════════════════════════════════════════════

  async upsertSubmission(userId, cfHandle, sub) {
    const query = `
      INSERT INTO cf_submissions 
        (id, user_id, cf_handle, contest_id, problem_index, problem_name, problem_rating,
         problem_tags, verdict, programming_language, time_consumed_millis, 
         memory_consumed_bytes, creation_time_seconds, relative_time_seconds, is_practice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        verdict = VALUES(verdict)
    `;
    const problem = sub.problem || {};
    await pool.query(query, [
      sub.id,
      userId,
      cfHandle,
      problem.contestId || sub.contestId || null,
      problem.index || null,
      problem.name || null,
      problem.rating || null,
      JSON.stringify(problem.tags || []),
      sub.verdict || null,
      sub.programmingLanguage || null,
      sub.timeConsumedMillis || null,
      sub.memoryConsumedBytes || null,
      sub.creationTimeSeconds || null,
      sub.relativeTimeSeconds || null,
      sub.author?.participantType === 'PRACTICE' ? 1 : 0,
    ]);
  },

  async getSubmissionCount(userId) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM cf_submissions WHERE user_id = ?',
      [userId]
    );
    return rows[0].count;
  },

  async getLatestSubmissionTime(userId) {
    const [rows] = await pool.query(
      'SELECT MAX(creation_time_seconds) as latest FROM cf_submissions WHERE user_id = ?',
      [userId]
    );
    return rows[0]?.latest || null;
  },

  // ═══════════════════════════════════════════════
  // USER PROBLEM STATUS (denormalized)
  // ═══════════════════════════════════════════════

  async rebuildUserProblemStatus(userId) {
    // Clear existing statuses for the user
    await pool.query('DELETE FROM cf_user_problem_status WHERE user_id = ?', [userId]);

    // Rebuild from submissions
    const query = `
      INSERT INTO cf_user_problem_status 
        (user_id, contest_id, problem_index, problem_name, problem_rating, problem_tags,
         status, total_attempts, first_attempt_time, solved_time, solved_during_contest)
      SELECT 
        user_id,
        contest_id,
        problem_index,
        MAX(problem_name) as problem_name,
        MAX(problem_rating) as problem_rating,
        MAX(problem_tags) as problem_tags,
        IF(SUM(verdict = 'OK') > 0, 'solved', 'attempted') as status,
        COUNT(*) as total_attempts,
        MIN(creation_time_seconds) as first_attempt_time,
        MIN(IF(verdict = 'OK', creation_time_seconds, NULL)) as solved_time,
        IF(SUM(verdict = 'OK' AND is_practice = 0) > 0, 1, 0) as solved_during_contest
      FROM cf_submissions
      WHERE user_id = ? AND contest_id IS NOT NULL AND problem_index IS NOT NULL
      GROUP BY user_id, contest_id, problem_index
    `;
    await pool.query(query, [userId]);
  },

  async getUserProblemStats(userId) {
    const [rows] = await pool.query(
      `SELECT 
        COUNT(*) as total_problems,
        SUM(status = 'solved') as solved,
        SUM(status = 'attempted') as attempted
       FROM cf_user_problem_status WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  },

  async getSolvedProblemIds(userId) {
    const [rows] = await pool.query(
      `SELECT CONCAT(contest_id, '-', problem_index) as pid 
       FROM cf_user_problem_status 
       WHERE user_id = ? AND status = 'solved'`,
      [userId]
    );
    return new Set(rows.map(r => r.pid));
  },
};
