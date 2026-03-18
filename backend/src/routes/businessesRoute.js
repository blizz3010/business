import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { CATEGORY_SQL_CASE, normalizeCategory } from '../services/categoryService.js';

export const businessesRouter = Router();

let indexReadyPromise;

function ensureGeoIndexes() {
  if (!indexReadyPromise) {
    indexReadyPromise = Promise.all([
      pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_lat ON businesses (lat)'),
      pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_lng ON businesses (lng)'),
      pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_lat_lng ON businesses (lat, lng)')
    ]);
  }

  return indexReadyPromise;
}

function formatBusinessRow(row) {
  return {
    ...row,
    lat: Number(row.lat),
    lng: Number(row.lng),
    rating: row.rating === null ? null : Number(row.rating),
    review_count: Number(row.review_count || 0),
    opportunity_score: Number(row.opportunity_score || 0),
    normalized_category: normalizeCategory(row.category)
  };
}

function parseOptionalNumber(value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

businessesRouter.get('/businesses', async (req, res) => {
  try {
    await ensureGeoIndexes();

    const { minRating, minReviews, category, minLat, maxLat, minLng, maxLng } = req.query;

    const whereClauses = [];
    const params = [];

    const parsedMinRating = parseOptionalNumber(minRating);
    const parsedMinReviews = parseOptionalNumber(minReviews);
    const parsedMinLat = parseOptionalNumber(minLat);
    const parsedMaxLat = parseOptionalNumber(maxLat);
    const parsedMinLng = parseOptionalNumber(minLng);
    const parsedMaxLng = parseOptionalNumber(maxLng);

    if (parsedMinRating !== undefined) {
      params.push(parsedMinRating);
      whereClauses.push(`rating >= $${params.length}`);
    }

    if (parsedMinReviews !== undefined) {
      params.push(parsedMinReviews);
      whereClauses.push(`review_count >= $${params.length}`);
    }

    if (category) {
      params.push(String(category).toLowerCase());
      whereClauses.push(`(
        LOWER(category) = $${params.length}
        OR LOWER(normalized_category) = $${params.length}
      )`);
    }

    const hasBounds =
      parsedMinLat !== undefined &&
      parsedMaxLat !== undefined &&
      parsedMinLng !== undefined &&
      parsedMaxLng !== undefined;

    if (hasBounds) {
      params.push(parsedMinLat, parsedMaxLat, parsedMinLng, parsedMaxLng);
      const firstBoundIndex = params.length - 3;
      whereClauses.push(`lat BETWEEN $${firstBoundIndex} AND $${firstBoundIndex + 1}`);
      whereClauses.push(`lng BETWEEN $${firstBoundIndex + 2} AND $${firstBoundIndex + 3}`);
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    params.push(hasBounds ? 1000 : 500);

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
      ORDER BY opportunity_score DESC
      LIMIT $${params.length}
    `;

    const result = await pgPool.query(query, params);
    return res.json(result.rows.map(formatBusinessRow));
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

    return res.json(result.rows.map(formatBusinessRow));
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
