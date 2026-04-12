import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { parseNumber, sendServerError, sendValidationError } from '../utils/http.js';

export const businessesRouter = Router();

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;

businessesRouter.get('/businesses', async (req, res) => {
  try {
    const { minRating, minReviews, category, subcategory, south, north, west, east, limit, offset } = req.query;

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

    if (subcategory) {
      params.push(String(subcategory).toLowerCase());
      whereClauses.push(`LOWER(subcategory) = $${params.length}`);
    } else if (category) {
      params.push(String(category).toLowerCase());
      whereClauses.push(`LOWER(normalized_category) = $${params.length}`);
    }

    const parsedLimit = Math.min(Math.max(parseNumber(limit) ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const parsedOffset = Math.max(parseNumber(offset) ?? 0, 0);

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    params.push(parsedLimit);
    const limitPlaceholder = `$${params.length}`;
    params.push(parsedOffset);
    const offsetPlaceholder = `$${params.length}`;

    const query = `
      SELECT
        name,
        place_id,
        lat,
        lng,
        rating,
        review_count,
        category,
        normalized_category,
        subcategory,
        address,
        opportunity_score
      FROM (
        SELECT
          name,
          place_id,
          lat,
          lng,
          rating,
          review_count,
          category,
          normalized_category,
          subcategory,
          address,
          (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score
        FROM businesses
      ) enriched
      ${whereSQL}
      ORDER BY review_count DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `;

    const result = await pgPool.query(query, params);

    return res.json(result.rows);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch businesses', error);
  }
});

// Search businesses across name, category, subcategory, and address
businessesRouter.get('/search', async (req, res) => {
  try {
    const { q, south, north, west, east, limit } = req.query;

    if (!q || String(q).trim().length === 0) {
      return sendValidationError(res, 'Search query "q" is required.');
    }

    const searchTerm = String(q).trim();
    const parsedLimit = Math.min(Math.max(parseNumber(limit) ?? 500, 1), 2000);

    // $1 is the search pattern — used multiple times in the query
    const params = [`%${searchTerm}%`];

    // Multi-field search: match across name, subcategory, normalized_category, category, and address
    const searchCondition = `(
      name ILIKE $1
      OR subcategory ILIKE $1
      OR normalized_category ILIKE $1
      OR category ILIKE $1
      OR address ILIKE $1
    )`;

    const boundsClauses = [];

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

    if (hasValidBounds) {
      params.push(parsedSouth);
      boundsClauses.push(`lat >= $${params.length}`);
      params.push(parsedNorth);
      boundsClauses.push(`lat <= $${params.length}`);
      params.push(parsedWest);
      boundsClauses.push(`lng >= $${params.length}`);
      params.push(parsedEast);
      boundsClauses.push(`lng <= $${params.length}`);
    }

    const boundsSQL = boundsClauses.length > 0 ? `AND ${boundsClauses.join(' AND ')}` : '';

    params.push(parsedLimit);
    const limitPlaceholder = `$${params.length}`;

    // Relevance scoring: name matches rank highest, then subcategory/category, then address
    const query = `
      SELECT
        name,
        place_id,
        lat,
        lng,
        rating,
        review_count,
        category,
        normalized_category,
        subcategory,
        address,
        (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score,
        CASE
          WHEN name ILIKE $1 THEN 3
          WHEN subcategory ILIKE $1 THEN 2
          WHEN normalized_category ILIKE $1 THEN 2
          WHEN category ILIKE $1 THEN 1
          WHEN address ILIKE $1 THEN 1
          ELSE 0
        END AS relevance
      FROM businesses
      WHERE ${searchCondition} ${boundsSQL}
      ORDER BY relevance DESC, review_count DESC
      LIMIT ${limitPlaceholder}
    `;

    const result = await pgPool.query(query, params);

    return res.json({
      query: searchTerm,
      total: result.rows.length,
      businesses: result.rows
    });
  } catch (error) {
    return sendServerError(res, 'Failed to search businesses', error);
  }
});

// Get subcategories grouped by parent category
businessesRouter.get('/subcategories', async (_req, res) => {
  try {
    const result = await pgPool.query(`
      SELECT
        normalized_category AS category,
        subcategory,
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        AVG(review_count) as avg_reviews
      FROM businesses
      GROUP BY normalized_category, subcategory
      ORDER BY normalized_category, total DESC
    `);

    // Group by parent category
    const grouped = {};
    for (const row of result.rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = [];
      }
      grouped[row.category].push({
        subcategory: row.subcategory,
        total: row.total,
        avg_rating: row.avg_rating,
        avg_reviews: row.avg_reviews
      });
    }

    return res.json(grouped);
  } catch (error) {
    return sendServerError(res, 'Failed to fetch subcategories', error);
  }
});

async function fetchPriorityTargets(_req, res) {
  try {
    const result = await pgPool.query(`
      SELECT
        *,
        (review_count * (5 - COALESCE(rating, 0))) AS opportunity_score,
        normalized_category,
        subcategory
      FROM businesses
      WHERE rating < 3.8
        AND review_count > 100
      ORDER BY review_count DESC
      LIMIT 1000
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
