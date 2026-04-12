import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pgPool } from '../db/index.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { sendServerError, sendValidationError } from '../utils/http.js';

export const authRouter = Router();

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function createSession(userId) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await pgPool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

// ── Register ────────────────────────────────────────────────────────────────
authRouter.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return sendValidationError(res, 'Email, password, and name are required');
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = String(name).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return sendValidationError(res, 'Invalid email address');
    }

    if (password.length < 6) {
      return sendValidationError(res, 'Password must be at least 6 characters');
    }

    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return sendValidationError(res, 'Name must be between 1 and 100 characters');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user;
    try {
      const result = await pgPool.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [trimmedEmail, passwordHash, trimmedName]
      );
      user = result.rows[0];
    } catch (insertError) {
      if (insertError.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
      throw insertError;
    }

    const token = await createSession(user.id);

    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    return sendServerError(res, 'Registration failed', error);
  }
});

// ── Login ───────────────────────────────────────────────────────────────────
authRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendValidationError(res, 'Email and password are required');
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    const result = await pgPool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await createSession(user.id);

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    return sendServerError(res, 'Login failed', error);
  }
});

// ── Logout ──────────────────────────────────────────────────────────────────
authRouter.post('/auth/logout', authenticateToken, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (token) {
      await pgPool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }

    return res.json({ message: 'Logged out successfully' });
  } catch (error) {
    return sendServerError(res, 'Logout failed', error);
  }
});

// ── Get current user ────────────────────────────────────────────────────────
authRouter.get('/auth/me', authenticateToken, requireAuth, (req, res) => {
  return res.json({
    user: { user_id: req.user.user_id, email: req.user.email, name: req.user.name }
  });
});
