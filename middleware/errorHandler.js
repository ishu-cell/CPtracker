// middleware/errorHandler.js — Global Express error handler

/**
 * Catches all unhandled errors from route handlers.
 * Must be registered LAST with app.use().
 *
 * Controllers should call next(error) instead of try/catch + res.status(500).
 */
export function errorHandler(err, req, res, _next) {
  // Log the full error server-side
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build response
  const response = {
    error: err.name || 'InternalServerError',
    message: statusCode === 500
      ? 'An unexpected error occurred. Please try again.'
      : err.message,
  };

  // Include stack trace in development only
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Factory for creating errors with specific status codes.
 * Usage: throw createError(404, 'Problem not found');
 */
export function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
