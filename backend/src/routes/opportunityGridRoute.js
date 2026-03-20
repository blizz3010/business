import { Router } from 'express';
import { pgPool } from '../db/index.js';
import { redis } from '../db/index.js';
import { parseNumber, sendServerError, sendValidationError } from '../utils/http.js';

export const opportunityGridRouter = Router();

/**
 * GET /api/opportunity-grid
 *
 * Finds real gaps between existing businesses of the selected category.
 * Instead of tiling the viewport with a dense grid, it:
 *   1. Fetches category businesses in the viewport
 *   2. Scans a coarse grid to find locations far from any existing competitor
 *   3. Scores by gap distance (farther from competitors = better) + local demand
 *   4. Enforces minimum spacing between markers so they don't cluster
 *   5. Returns top opportunities sorted by score
 *
 * Query params:
 *   south, north, west, east  – viewport bounding box (required)
 *   category                  – restrict to a single category (recommended)
 *   cellSize                  – grid scan resolution in meters (default 500)
 *   radius                    – search radius for demand signal (default 1500)
 *   limit                     – max markers to return (default 15)
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

    const cellSizeMeters = Math.min(Math.max(parseNumber(req.query.cellSize) ?? 500, 100), 2000);
    const radiusMeters = Math.min(Math.max(parseNumber(req.query.radius) ?? 1500, 200), 5000);
    const limit = Math.min(parseNumber(req.query.limit) ?? 15, 50);
    const filterCategory = req.query.category ? String(req.query.category) : null;

    // Minimum distance (km) between returned opportunity markers
    const MIN_MARKER_SPACING_KM = Math.min(Math.max(parseNumber(req.query.minSpacing) ?? 1.2, 0.1), 10.0);
    // Minimum distance (km) from nearest competitor to be considered a gap
    const MIN_GAP_KM = Math.min(Math.max(parseNumber(req.query.minGap) ?? 0.6, 0.05), 5.0);

    const cacheKey = `oppgrid2:${round4(south)}:${round4(north)}:${round4(west)}:${round4(east)}:${cellSizeMeters}:${radiusMeters}:${MIN_GAP_KM}:${MIN_MARKER_SPACING_KM}:${filterCategory ?? 'all'}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return res.json(JSON.parse(cached));
      } catch (err) {
        console.warn('Redis read failed for opportunity-grid:', err.message);
      }
    }

    // ── 1. Fetch businesses in padded viewport ────────────────────────────
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

    const allBusinesses = queryResult.rows;
    if (allBusinesses.length === 0) {
      return res.json([]);
    }

    // ── 2. Determine which category to evaluate ──────────────────────────
    const allCategories = [...new Set(allBusinesses.map((b) => b.normalized_category))];
    const categoriesToEvaluate = filterCategory
      ? allCategories.filter((c) => c === filterCategory)
      : allCategories;

    if (categoriesToEvaluate.length === 0) {
      return res.json([]);
    }

    // ── 3. Build spatial index ───────────────────────────────────────────
    const BUCKET_DEG = 0.008;
    const spatialIndex = new Map();
    const categoryIndex = new Map(); // separate index per category

    for (const b of allBusinesses) {
      const bKey = bucketKey(b.lat, b.lng, BUCKET_DEG);

      if (!spatialIndex.has(bKey)) spatialIndex.set(bKey, []);
      spatialIndex.get(bKey).push(b);

      const cat = b.normalized_category;
      if (!categoryIndex.has(cat)) categoryIndex.set(cat, new Map());
      const catMap = categoryIndex.get(cat);
      if (!catMap.has(bKey)) catMap.set(bKey, []);
      catMap.get(bKey).push(b);
    }

    function getNearbyAll(lat, lng, radiusKm) {
      return getFromIndex(spatialIndex, lat, lng, radiusKm, BUCKET_DEG);
    }

    function getNearbyCategory(cat, lat, lng, radiusKm) {
      const idx = categoryIndex.get(cat);
      if (!idx) return [];
      return getFromIndex(idx, lat, lng, radiusKm, BUCKET_DEG);
    }

    // ── 4. Scan grid and find gaps ───────────────────────────────────────
    const latStep = cellSizeMeters / 111320;
    const centerLat = (south + north) / 2;
    const lngStep = cellSizeMeters / (111320 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.2));
    const radiusKm = radiusMeters / 1000;

    const candidates = [];

    for (const targetCat of categoriesToEvaluate) {
      for (let lat = south; lat < north; lat += latStep) {
        for (let lng = west; lng < east; lng += lngStep) {
          const cellLat = lat + latStep / 2;
          const cellLng = lng + lngStep / 2;

          // Find nearest competitors of this category
          const competitors = getNearbyCategory(targetCat, cellLat, cellLng, radiusKm);

          // Find nearest competitor distance
          let nearestCompDist = radiusKm; // default to max if none found
          for (const c of competitors) {
            if (c.distance < nearestCompDist) nearestCompDist = c.distance;
          }

          // Skip if too close to an existing competitor (not a real gap)
          if (nearestCompDist < MIN_GAP_KM) continue;

          // Check demand: how many total businesses are nearby?
          const allNearby = getNearbyAll(cellLat, cellLng, radiusKm);
          const totalNearby = allNearby.length;

          // Skip dead zones with very few businesses (rural/empty areas)
          if (totalNearby < 5) continue;

          // ── Score components ──────────────────────────────────────────
          // Gap score (60%): how far from nearest competitor? Farther = better
          let gapScore;
          if (nearestCompDist >= 3.0) gapScore = 1.0;
          else if (nearestCompDist >= 2.0) gapScore = 0.85;
          else if (nearestCompDist >= 1.5) gapScore = 0.7;
          else if (nearestCompDist >= 1.0) gapScore = 0.55;
          else gapScore = 0.3;

          // Demand score (25%): commercial activity in the area
          const demandScore = Math.min(totalNearby / 40, 1.0);

          // Quality gap (15%): if there ARE competitors nearby, how weak are they?
          let qualityGapScore = 0.5; // neutral default
          if (competitors.length > 0) {
            const ratings = competitors
              .map((c) => c.business.rating)
              .filter((r) => r !== null && r !== undefined);
            if (ratings.length > 0) {
              const avgRating = ratings.reduce((s, r) => s + r, 0) / ratings.length;
              qualityGapScore = Math.max(0, (4.2 - avgRating) / 4.2);
            }
          }

          const score = Math.round(
            (0.60 * gapScore + 0.25 * demandScore + 0.15 * qualityGapScore) * 100
          );

          if (score < 30) continue;

          // Collect nearest competitors for popup
          const topCompetitors = competitors
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5)
            .map((c) => ({
              name: c.business.name,
              rating: c.business.rating,
              review_count: c.business.review_count,
              distance_km: round3(c.distance)
            }));

          candidates.push({
            lat: round6(cellLat),
            lng: round6(cellLng),
            category: targetCat,
            score,
            gap_km: round2(nearestCompDist),
            demand_score: Math.round(demandScore * 100),
            scarcity_score: Math.round(gapScore * 100),
            quality_gap_score: Math.round(qualityGapScore * 100),
            total_nearby: totalNearby,
            competitor_count: competitors.length,
            avg_competitor_rating: competitors.length > 0
              ? round2(competitors.reduce((s, c) => s + (c.business.rating ?? 0), 0) / competitors.length)
              : null,
            top_competitors: topCompetitors
          });
        }
      }
    }

    // ── 5. Deduplicate: greedy selection with minimum spacing ─────────────
    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    for (const candidate of candidates) {
      // Check if too close to an already-selected marker
      const tooClose = selected.some(
        (s) => haversineKm(s.lat, s.lng, candidate.lat, candidate.lng) < MIN_MARKER_SPACING_KM
      );
      if (tooClose) continue;

      selected.push(candidate);
      if (selected.length >= limit) break;
    }

    // ── 6. Cache and return ──────────────────────────────────────────────
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(selected), 'EX', 300);
      } catch (err) {
        console.warn('Redis write failed for opportunity-grid:', err.message);
      }
    }

    return res.json(selected);
  } catch (error) {
    return sendServerError(res, 'Failed to compute opportunity grid', error);
  }
});

// ── Utility helpers ────────────────────────────────────────────────────────

function bucketKey(lat, lng, bucketDeg) {
  return `${Math.floor(lat / bucketDeg)}:${Math.floor(lng / bucketDeg)}`;
}

function getFromIndex(index, lat, lng, radiusKm, bucketDeg) {
  const bLat = Math.floor(lat / bucketDeg);
  const bLng = Math.floor(lng / bucketDeg);
  const results = [];
  for (let dLat = -2; dLat <= 2; dLat++) {
    for (let dLng = -2; dLng <= 2; dLng++) {
      const entries = index.get(`${bLat + dLat}:${bLng + dLng}`);
      if (!entries) continue;
      for (const b of entries) {
        const d = haversineKm(lat, lng, b.lat, b.lng);
        if (d <= radiusKm) results.push({ business: b, distance: d });
      }
    }
  }
  return results;
}

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
function round3(n) { return Math.round(n * 1000) / 1000; }
function round4(n) { return Math.round(n * 10000) / 10000; }
function round6(n) { return Math.round(n * 1000000) / 1000000; }
