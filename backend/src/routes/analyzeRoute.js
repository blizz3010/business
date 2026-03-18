import { Router } from 'express';
import { redis } from '../db/index.js';
import { analyzeTile } from '../services/analysisService.js';
import { queryBusinessesInRadius } from '../services/businessService.js';

export const analyzeRouter = Router();

analyzeRouter.post('/analyze-tile', async (req, res) => {
  try {
    const { lat, lng, radius = 500 } = req.body;
    const cacheKey = `tile:${lat}:${lng}:${radius}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const businesses = await queryBusinessesInRadius(lat, lng, radius);
    const analysis = analyzeTile(businesses);

    await redis.set(cacheKey, JSON.stringify(analysis), 'EX', 900);

    return res.json(analysis);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to analyze tile', details: error.message });
  }
});
