import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { authenticateToken, requireAuth } from '../middleware/auth.js';
import { sendServerError, sendValidationError } from '../utils/http.js';

export const favoritesRouter = Router();

favoritesRouter.use(authenticateToken);
favoritesRouter.use(requireAuth);

// ── Get user's saved businesses ─────────────────────────────────────────────
favoritesRouter.get('/favorites', async (req, res) => {
  try {
    const result = await pgPool.query(
      `SELECT
         sb.id,
         sb.place_id,
         sb.business_name,
         sb.notes,
         sb.created_at,
         b.lat,
         b.lng,
         b.rating,
         b.review_count,
         b.normalized_category,
         b.subcategory,
         b.address
       FROM saved_businesses sb
       LEFT JOIN businesses b ON sb.place_id = b.place_id
       WHERE sb.user_id = $1
       ORDER BY sb.created_at DESC`,
      [req.user.user_id]
    );

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch saved businesses', error);
  }
});

// ── Save a business ─────────────────────────────────────────────────────────
favoritesRouter.post('/favorites', async (req, res) => {
  try {
    const { place_id, business_name, notes } = req.body;

    if (!place_id || !business_name) {
      return sendValidationError(res, 'place_id and business_name are required');
    }

    const result = await pgPool.query(
      `INSERT INTO saved_businesses (user_id, place_id, business_name, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, place_id) DO UPDATE SET notes = EXCLUDED.notes
       RETURNING id, place_id, business_name, notes, created_at`,
      [req.user.user_id, String(place_id), String(business_name), notes || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return sendServerError(res, 'Failed to save business', error);
  }
});

// ── Remove a saved business ─────────────────────────────────────────────────
favoritesRouter.delete('/favorites/:placeId', async (req, res) => {
  try {
    await pgPool.query(
      'DELETE FROM saved_businesses WHERE user_id = $1 AND place_id = $2',
      [req.user.user_id, req.params.placeId]
    );

    return res.json({ message: 'Removed from saved businesses' });
  } catch (error) {
    return sendServerError(res, 'Failed to remove business', error);
  }
});
