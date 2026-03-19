import { Router } from 'express';
import { redis } from '../db/index.js';
import { analyzeTile } from '../services/analysisService.js';
import { queryBusinessesInRadius } from '../services/businessService.js';
import { parseNumber, sendServerError, sendValidationError } from '../utils/http.js';

export const analyzeRouter = Router();

analyzeRouter.post('/analyze-tile', async (req, res) => {
  try {
    const lat = parseNumber(req.body?.lat);
    const lng = parseNumber(req.body?.lng);
    const radius = parseNumber(req.body?.radius) ?? 500;

    if (lat === null || lng === null || radius <= 0 || radius > 50_000) {
      return sendValidationError(res, 'lat/lng must be valid numbers and radius must be between 1 and 50000 meters.');
    }

    const cacheKey = `tile:${lat}:${lng}:${radius}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (cacheError) {
        console.warn('Redis cache read failed for analyze-tile:', cacheError.message);
      }
    }

    const businesses = await queryBusinessesInRadius(lat, lng, radius);
    const analysis = analyzeTile(businesses);

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(analysis), { ex: 900 });
      } catch {
        try {
          await redis.set(cacheKey, JSON.stringify(analysis), 'EX', 900);
        } catch (cacheError) {
          console.warn('Redis cache write failed for analyze-tile:', cacheError.message);
        }
      }
    }

    return res.json(analysis);
  } catch (error) {
    return sendServerError(res, 'Failed to analyze tile', error);
  }
});
