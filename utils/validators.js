// utils/validators.js — Input validation helpers
import { createError } from '../middleware/errorHandler.js';

/**
 * Validate that required fields exist in the request body.
 * Throws a 400 error with a descriptive message if any are missing.
 *
 * @param {object} body — req.body
 * @param {string[]} fields — required field names
 */
export function requireFields(body, fields) {
  const missing = fields.filter(f => !body[f] || (typeof body[f] === 'string' && body[f].trim() === ''));
  if (missing.length > 0) {
    throw createError(400, `Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Validate that a value is a positive integer (for IDs, ratings, etc.).
 * Returns the parsed integer or throws 400.
 */
export function parsePositiveInt(value, fieldName = 'value') {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    throw createError(400, `${fieldName} must be a non-negative integer.`);
  }
  return parsed;
}

/**
 * Sanitize a Codeforces handle.
 * CF handles: 1-24 characters, letters, digits, underscores, hyphens.
 */
export function validateCfHandle(handle) {
  if (!handle || typeof handle !== 'string') {
    throw createError(400, 'Codeforces handle is required.');
  }
  const trimmed = handle.trim();
  if (trimmed.length < 1 || trimmed.length > 24) {
    throw createError(400, 'Codeforces handle must be 1-24 characters.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw createError(400, 'Codeforces handle contains invalid characters.');
  }
  return trimmed;
}
