import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { redis } from '../db/index.js';
import { parseNumber, sendServerError, sendValidationError } from '../utils/http.js';

export const opportunityGridRouter = Router();

/**
 * GET /api/opportunity-grid
 *
 * Computes per-category opportunity scores for a grid of cells within the
 * given viewport bounds.  Each cell is evaluated independently for every
 * normalized_category present in the database.  The response is an array of
 * opportunity cells, each tagged with the category it represents, a 0-100
 * score, and supporting stats.
 *
 * Query params:
 *   south, north, west, east  – viewport bounding box (required)
 *   category                  – optional; restrict to a single category
 *   cellSize                  – grid cell size in meters (default 500)
 *   radius                    – search radius in meters per cell (default 800)
 *   limit                     – max cells to return (default 80)
 */
opportunityGridRouter.get('/opportunity-grid', async (req, res) => {
  try {
    const south = parseNumber(req.query.south);
    const north = parseNumber(req.query.north);
    const west = parseNumber(req.query.west);
    const east = parseNumber(req.query.east);

    if (
      south === null || north === null || west === null || east === null ||
      south >= north || west >= east
    ) {
      return sendValidationError(res, 'south, north, west, east must form a valid bounding box.');
    }

    const cellSizeMeters = parseNumber(req.query.cellSize) ?? 500;
    const radiusMeters = parseNumber(req.query.radius) ?? 800;
    const limit = Math.min(parseNumber(req.query.limit) ?? 80, 200);
    const filterCategory = req.query.category ? String(req.query.category) : null;

    // Build a cache key from rounded bounds so nearby viewports share cache
    const cacheKey = `oppgrid:${round4(south)}:${round4(north)}:${round4(west)}:${round4(east)}:${cellSizeMeters}:${radiusMeters}:${filterCategory ?? 'all'}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch (err) {
        console.warn('Redis read failed for opportunity-grid:', err.message);
      }
    }

    // ── 1. Fetch all businesses in a padded viewport ──────────────────────
    const padDeg = radiusMeters / 111320;
    const queryResult = await pgPool.query(
      `SELECT name, lat, lng, rating, review_count, category, normalized_category
       FROM businesses
       WHERE lat BETWEEN $1 AND $2
         AND lng BETWEEN $3 AND $4
       ORDER BY review_count DESC
       LIMIT 5000`,
      [south - padDeg, north + padDeg, west - padDeg, east + padDeg]
    );

    const businesses = queryResult.rows;
    if (businesses.length === 0) {
      return res.json([]);
    }

    // ── 2. Get the distinct categories to evaluate ───────────────────────
    const allCategories = [...new Set(businesses.map((b) => b.normalized_category))];
    const categoriesToEvaluate = filterCategory
      ? allCategories.filter((c) => c === filterCategory)
      : allCategories;

    if (categoriesToEvaluate.length === 0) {
      return res.json([]);
    }

    // ── 3. Build spatial index for fast radius lookups ────────────────────
    const BUCKET_DEG = 0.006; // ~670m at Orlando's latitude
    const spatialIndex = new Map();

    for (const b of businesses) {
      const bLat = Math.floor(b.lat / BUCKET_DEG);
      const bLng = Math.floor(b.lng / BUCKET_DEG);
      const key = `${bLat}:${bLng}`;
      if (!spatialIndex.has(key)) spatialIndex.set(key, []);
      spatialIndex.get(key).push(b);
    }

    function getNearby(lat, lng, radiusKm) {
      const bLat = Math.floor(lat / BUCKET_DEG);
      const bLng = Math.floor(lng / BUCKET_DEG);
      const results = [];
      for (let dLat = -2; dLat <= 2; dLat++) {
        for (let dLng = -2; dLng <= 2; dLng++) {
          const entries = spatialIndex.get(`${bLat + dLat}:${bLng + dLng}`);
          if (!entries) continue;
          for (const b of entries) {
            const d = haversineKm(lat, lng, b.lat, b.lng);
            if (d <= radiusKm) results.push({ business: b, distance: d });
          }
        }
      }
      return results;
    }

    // ── 4. Generate grid cells and score each category at each cell ──────
    const latStep = cellSizeMeters / 111320;
    const centerLat = (south + north) / 2;
    const lngStep = cellSizeMeters / (111320 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));
    const radiusKm = radiusMeters / 1000;

    const rawCells = [];

    for (let lat = south; lat < north; lat += latStep) {
      for (let lng = west; lng < east; lng += lngStep) {
        const cellLat = lat + latStep / 2;
        const cellLng = lng + lngStep / 2;

        const nearby = getNearby(cellLat, cellLng, radiusKm);
        if (nearby.length < 3) continue; // skip dead zones

        const totalNearby = nearby.length;

        // Group nearby businesses by normalized_category
        const byCategory = new Map();
        for (const { business, distance } of nearby) {
          const cat = business.normalized_category;
          if (!byCategory.has(cat)) byCategory.set(cat, []);
          byCategory.get(cat).push({ business, distance });
        }

        // Score each target category at this cell
        for (const targetCat of categoriesToEvaluate) {
          const competitors = byCategory.get(targetCat) || [];
          const competitorCount = competitors.length;

          // ── Demand signal (30%): how active is this commercial area? ──
          const demandScore = Math.min(totalNearby / 30, 1.0);

          // ── Category scarcity (45%): fewer competitors = higher opportunity ──
          let scarcityScore;
          if (competitorCount === 0) {
            scarcityScore = 1.0;
          } else if (competitorCount === 1) {
            scarcityScore = 0.75;
          } else if (competitorCount === 2) {
            scarcityScore = 0.45;
          } else if (competitorCount <= 4) {
            scarcityScore = 0.2;
          } else {
            scarcityScore = 0.0;
          }

          // ── Quality gap (25%): weak existing competitors = more room ──
          let qualityGapScore = 0;
          if (competitorCount > 0) {
            const ratings = competitors
              .map((c) => c.business.rating)
              .filter((r) => r !== null && r !== undefined);
            const avgRating = ratings.length > 0
              ? ratings.reduce((s, r) => s + r, 0) / ratings.length
              : 3.5; // assume average if no rating data
            // Lower avg rating = bigger gap = higher score
            qualityGapScore = Math.max(0, (4.0 - avgRating) / 4.0);
          } else {
            // No competitors at all → quality gap is irrelevant, scarcity
            // already captures this, so set neutral
            qualityGapScore = 0.5;
          }

          const score = Math.round(
            (0.30 * demandScore + 0.45 * scarcityScore + 0.25 * qualityGapScore) * 100
          );

          if (score < 35) continue; // below threshold

          // Collect top competitors for the popup
          const topCompetitors = competitors
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .map((c) => ({
              name: c.business.name,
              rating: c.business.rating,
              review_count: c.business.review_count,
              distance_km: Math.round(c.distance * 1000) / 1000
            }));

          rawCells.push({
            lat: round6(cellLat),
            lng: round6(cellLng),
            category: targetCat,
            score,
            demand_score: Math.round(demandScore * 100),
            scarcity_score: Math.round(scarcityScore * 100),
            quality_gap_score: Math.round(qualityGapScore * 100),
            total_nearby: totalNearby,
            competitor_count: competitorCount,
            avg_competitor_rating: competitors.length > 0
              ? round2(competitors.reduce((s, c) => s + (c.business.rating ?? 0), 0) / competitors.length)
              : null,
            top_competitors: topCompetitors
          });
        }
      }
    }

    // ── 5. When showing all categories, keep only the best opportunity per cell ─
    let cells;
    if (filterCategory) {
      // Single category mode: return all cells for that category
      cells = rawCells
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } else {
      // All-categories mode: for each grid position, keep only the highest-scoring category
      const cellMap = new Map();
      for (const cell of rawCells) {
        const posKey = `${cell.lat}:${cell.lng}`;
        const existing = cellMap.get(posKey);
        if (!existing || cell.score > existing.score) {
          cellMap.set(posKey, cell);
        }
      }
      cells = [...cellMap.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    // ── 6. Cache and return ──────────────────────────────────────────────
    const response_data = cells;

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(response_data), 'EX', 300);
      } catch (err) {
        console.warn('Redis write failed for opportunity-grid:', err.message);
      }
    }

    return res.json(response_data);
  } catch (error) {
    return sendServerError(res, 'Failed to compute opportunity grid', error);
  }
});

// ── Utility helpers ────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }
function round6(n) { return Math.round(n * 1000000) / 1000000; }
