// controllers/problems.controller.js — Request handlers for /api/problems
import { ProblemsRepository } from '../repositories/problems.repository.js';
import { requireFields, parsePositiveInt } from '../utils/validators.js';
import { createError } from '../middleware/errorHandler.js';

export const ProblemsController = {
  /**
   * GET /api/problems
   * Returns all problems for the authenticated user.
   */
  async getAll(req, res, next) {
    try {
      const problems = await ProblemsRepository.findAllByUser(req.userId);
      res.json(problems);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/problems
   * Creates a new problem for the authenticated user.
   */
  async create(req, res, next) {
    try {
      requireFields(req.body, ['title', 'platform']);

      const { title, platform, rating, status } = req.body;
      const created = await ProblemsRepository.create(req.userId, {
        title: title.trim(),
        platform,
        rating: rating ? parseInt(rating, 10) : null,
        status,
      });

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/problems/:id
   * Updates an existing problem. Only the owner can update.
   */
  async update(req, res, next) {
    try {
      const problemId = parsePositiveInt(req.params.id, 'Problem ID');
      const { title, platform, rating, status, whiteboard_data } = req.body;

      const affectedRows = await ProblemsRepository.update(problemId, req.userId, {
        title,
        platform,
        rating: rating ? parseInt(rating, 10) : null,
        status,
        whiteboard_data,
      });

      if (affectedRows === 0) {
        throw createError(404, 'Problem not found or unauthorized.');
      }

      res.json({
        message: 'Problem updated successfully!',
        problem: {
          id: problemId,
          user_id: req.userId,
          title,
          platform,
          rating,
          status,
          whiteboard_data,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/problems/:id
   * Deletes a problem. Only the owner can delete.
   */
  async remove(req, res, next) {
    try {
      const problemId = parsePositiveInt(req.params.id, 'Problem ID');

      const affectedRows = await ProblemsRepository.remove(problemId, req.userId);

      if (affectedRows === 0) {
        throw createError(404, 'Problem not found or unauthorized.');
      }

      res.json({ message: 'Problem deleted successfully!' });
    } catch (error) {
      next(error);
    }
  },
};
