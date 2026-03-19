import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { parseNumber, sendServerError, sendValidationError } from '../utils/http.js';

export const businessesRouter = Router();

businessesRouter.get('/businesses', async (req, res) => {
  try {
    const { minRating, minReviews, category, south, north, west, east } = req.query;

    const whereClauses = [];
    const params = [];
    const parsedSouth = parseNumber(south);
    const parsedNorth = parseNumber(north);
    const parsedWest = parseNumber(west);
    const parsedEast = parseNumber(east);

    const hasValidBounds =
      parsedSouth !== null &&
      parsedNorth !== null &&
      parsedWest !== null &&
      parsedEast !== null &&
      parsedSouth < parsedNorth &&
      parsedWest < parsedEast;

    if (!hasValidBounds) {
      return sendValidationError(res, 'south, north, west, and east must be valid bounds values.');
    }

    params.push(parsedSouth);
    whereClauses.push(`lat >= $${params.length}`);
    params.push(parsedNorth);
    whereClauses.push(`lat <= $${params.length}`);
    params.push(parsedWest);
    whereClauses.push(`lng >= $${params.length}`);
    params.push(parsedEast);
    whereClauses.push(`lng <= $${params.length}`);

    if (minRating !== undefined) {
      const parsed = parseNumber(minRating);
      if (parsed !== null) {
        params.push(parsed);
        whereClauses.push(`rating >= $${params.length}`);
      }
    }

    if (minReviews !== undefined) {
      const parsed = parseNumber(minReviews);
      if (parsed !== null) {
        params.push(parsed);
        whereClauses.push(`review_count >= $${params.length}`);
      }
    }

    if (category) {
      params.push(String(category).toLowerCase());
      whereClauses.push(`(
        LOWER(category) = $${params.length}
        OR LOWER(normalized_category) = $${params.length}
      )`);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT
        name,
        lat,
        lng,
        rating,
        review_count,
        category,
        normalized_category,
        opportunity_score
      FROM (
        SELECT
          name,
          lat,
          lng,
          rating,
          review_count,
          category,
          normalized_category,
          (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score
        FROM businesses
      ) enriched
      ${whereSQL}
      ORDER BY review_count DESC
    `;

    const result = await pgPool.query(query, params);

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch businesses', error);
  }
});

async function fetchPriorityTargets(_req, res) {
  try {
    const result = await pgPool.query(`
      SELECT
        *,
        (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score,
        normalized_category
      FROM businesses
      WHERE rating < 3.8
        AND review_count > 100
      ORDER BY review_count DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch priority targets', error);
  }
}

businessesRouter.get('/priority-targets', fetchPriorityTargets);
businessesRouter.get('/opportunities', fetchPriorityTargets);

businessesRouter.get('/heatmap', async (_req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        ROUND(lat::numeric, 2) as lat_bucket,
        ROUND(lng::numeric, 2) as lng_bucket,
        COUNT(*) as business_count,
        AVG(rating) as avg_rating,
        SUM(review_count) as total_reviews
      FROM businesses
      GROUP BY lat_bucket, lng_bucket
      ORDER BY total_reviews DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch heatmap', error);
  }
});

businessesRouter.get('/categories', async (_req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        normalized_category AS category,
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        AVG(review_count) as avg_reviews
      FROM businesses
      GROUP BY normalized_category
      ORDER BY total DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch categories', error);
  }
});
