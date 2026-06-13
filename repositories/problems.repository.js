// repositories/problems.repository.js — Database queries for the problems table
import { pool } from '../config/database.js';

export const ProblemsRepository = {
  /**
   * Get all problems for a user, newest first.
   */
  async findAllByUser(userId) {
    const [rows] = await pool.query(
      'SELECT * FROM problems WHERE user_id = ? ORDER BY id DESC',
      [userId]
    );
    return rows;
  },

  /**
   * Find a single problem by ID, scoped to a user.
   * Returns the row or undefined.
   */
  async findByIdAndUser(problemId, userId) {
    const [rows] = await pool.query(
      'SELECT * FROM problems WHERE id = ? AND user_id = ?',
      [problemId, userId]
    );
    return rows[0];
  },

  /**
   * Insert a new problem.
   * Returns the created problem object with its new ID.
   */
  async create(userId, { title, platform, rating, status }) {
    const query = 'INSERT INTO problems (user_id, title, platform, rating, status) VALUES (?, ?, ?, ?, ?)';
    const values = [userId, title, platform, rating || null, status || 'attempted'];

    const [result] = await pool.query(query, values);

    return {
      id: result.insertId,
      user_id: userId,
      title,
      platform,
      rating: rating || null,
      status: status || 'attempted',
    };
  },

  /**
   * Update an existing problem.
   * Returns the number of affected rows (0 if not found / unauthorized).
   */
  async update(problemId, userId, { title, platform, rating, status, whiteboard_data }) {
    const wbString = whiteboard_data ? JSON.stringify(whiteboard_data) : null;
    const query = `
      UPDATE problems 
      SET title = ?, platform = ?, rating = ?, status = ?, whiteboard_data = ?
      WHERE id = ? AND user_id = ?
    `;
    const values = [title, platform, rating || null, status, wbString, problemId, userId];

    const [result] = await pool.query(query, values);
    return result.affectedRows;
  },

  /**
   * Delete a problem.
   * Returns the number of affected rows (0 if not found / unauthorized).
   */
  async remove(problemId, userId) {
    const [result] = await pool.query(
      'DELETE FROM problems WHERE id = ? AND user_id = ?',
      [problemId, userId]
    );
    return result.affectedRows;
  },
};
