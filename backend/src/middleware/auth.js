import { pgPool } from '../db/index.js';

/**
 * Middleware that extracts and validates a Bearer token from the Authorization header.
 * Sets req.user to the authenticated user object or null if not authenticated.
 * Always calls next() — does not block unauthenticated requests.
 */
export async function authenticateToken(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const result = await pgPool.query(
      `SELECT s.user_id, u.email, u.name
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    req.user = result.rows.length > 0 ? result.rows[0] : null;
  } catch {
    req.user = null;
  }

  next();
}

/**
 * Middleware that requires an authenticated user. Must be used after authenticateToken.
 * Returns 401 if req.user is not set.
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
