// middleware/auth.js — Clerk authentication middleware
import { getAuth } from '@clerk/express';

/**
 * Extracts the authenticated user's ID from the Clerk session
 * and injects it as `req.userId`. Returns 401 if unauthenticated.
 *
 * Usage: router.use(requireAuth);
 */
export function requireAuth(req, res, next) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be signed in to access this resource.',
    });
  }

  // Inject userId into request for downstream use
  req.userId = userId;
  next();
}
