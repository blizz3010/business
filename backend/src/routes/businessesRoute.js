import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { CATEGORY_SQL_CASE, normalizeCategory } from '../services/categoryService.js';

export const businessesRouter = Router();

businessesRouter.get('/businesses', async (req, res) => {
  try {
    const { minRating, minReviews, category, south, north, west, east } = req.query;

    const whereClauses = [];
    const params = [];
    const parsedSouth = Number(south);
    const parsedNorth = Number(north);
    const parsedWest = Number(west);
    const parsedEast = Number(east);

    const hasValidBounds =
      !Number.isNaN(parsedSouth) &&
      !Number.isNaN(parsedNorth) &&
      !Number.isNaN(parsedWest) &&
      !Number.isNaN(parsedEast);

    if (!hasValidBounds) {
      return res.status(400).json({ error: 'south, north, west, and east query params are required numbers.' });
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
      const parsed = Number(minRating);
      if (!Number.isNaN(parsed)) {
        params.push(parsed);
        whereClauses.push(`rating >= $${params.length}`);
      }
    }

    if (minReviews !== undefined) {
      const parsed = Number(minReviews);
      if (!Number.isNaN(parsed)) {
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
      WITH enriched AS (
        SELECT
          name,
          lat,
          lng,
          rating,
          review_count,
          category,
          ${CATEGORY_SQL_CASE} AS normalized_category,
          (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score
        FROM businesses
      )
      SELECT
        name,
        lat,
        lng,
        rating,
        review_count,
        category,
        normalized_category,
        opportunity_score
      FROM enriched
      ${whereSQL}
      ORDER BY review_count DESC
    `;

    const result = await pgPool.query(query, params);

    return res.json(result.rows.map((row) => ({ ...row, normalized_category: row.normalized_category })));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch businesses', details: error.message });
  }
});

businessesRouter.get('/opportunities', async (_req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        *,
        (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score,
        ${CATEGORY_SQL_CASE} AS normalized_category
      FROM businesses
      WHERE rating < 3.8
        AND review_count > 100
      ORDER BY review_count DESC
    `);

    return res.json(result.rows.map((row) => ({ ...row, normalized_category: normalizeCategory(row.category) })));
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch opportunities', details: error.message });
  }
});

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
    return res.status(500).json({ error: 'Failed to fetch heatmap', details: error.message });
  }
});

businessesRouter.get('/categories', async (_req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        ${CATEGORY_SQL_CASE} AS category,
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        AVG(review_count) as avg_reviews
      FROM businesses
      GROUP BY 1
      ORDER BY total DESC
    `);

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});
