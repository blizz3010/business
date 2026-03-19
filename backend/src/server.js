import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRouter } from './routes/analyzeRoute.js';
import { businessesRouter } from './routes/businessesRoute.js';
import { connectRedisIfConfigured, isRedisHealthy, pgPool } from './db/index.js';

dotenv.config();

const app = express();

const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

allowedOrigins.add('http://localhost:3000');
allowedOrigins.add('http://127.0.0.1:3000');

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

function createInMemoryRateLimiter({ windowMs, max }) {
  const requests = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = requests.get(key) ?? { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count += 1;
    requests.set(key, entry);

    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests', details: 'Please retry shortly.' });
    }

    return next();
  };
}

const apiRateLimit = createInMemoryRateLimiter({ windowMs: 60_000, max: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 120) });
const analyzeRateLimit = createInMemoryRateLimiter({
  windowMs: 60_000,
  max: Number(process.env.ANALYZE_RATE_LIMIT_PER_MINUTE || 30)
});

app.use(corsMiddleware);
app.options('*', corsMiddleware);
app.use(express.json());
app.use('/api', apiRateLimit);
app.use('/api/analyze-tile', analyzeRateLimit);

app.get('/health', async (_req, res) => {
  let postgres = false;
  let redis = false;

  try {
    await pgPool.query('SELECT 1');
    postgres = true;
  } catch {
    postgres = false;
  }

  redis = await isRedisHealthy();

  const ok = postgres && (process.env.REDIS_URL ? redis : true);
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'StreetScope AI backend',
    dependencies: { postgres, redis: process.env.REDIS_URL ? redis : 'not_configured' }
  });
});

app.use('/api', analyzeRouter);
app.use('/api', businessesRouter);

app.use((error, _req, res, _next) => {
  if (error?.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ error: 'CORS blocked', details: error.message });
  }
  return res.status(500).json({ error: 'Unhandled server error', details: error?.message ?? 'Unknown error' });
});

const port = process.env.PORT || 4000;

connectRedisIfConfigured().finally(() => {
  app.listen(port, () => {
    console.log(`StreetScope backend running on ${port}`);
  });
});
