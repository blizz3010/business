import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { CATEGORY_SQL_CASE } from '../services/categoryService.js';

dotenv.config();

const { Pool } = pg;

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const redisUrl = process.env.REDIS_URL;
export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    })
  : null;

if (redis) {
  redis.on('error', (error) => {
    console.warn('Redis connection issue:', error.message);
  });
}

export async function connectRedisIfConfigured() {
  if (!redis) return false;

  if (redis.status === 'ready') return true;

  try {
    await redis.connect();
    return true;
  } catch (error) {
    console.warn('Failed to establish Redis connection during startup:', error.message);
    return false;
  }
}

export async function isRedisHealthy() {
  if (!redis) return false;

  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function ensureBusinessSchemaReady() {
  await pgPool.query(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS normalized_category TEXT
  `);

  await pgPool.query(`
    UPDATE businesses
    SET normalized_category = ${CATEGORY_SQL_CASE}
    WHERE normalized_category IS NULL
  `);

  await pgPool.query(`
    ALTER TABLE businesses
    ALTER COLUMN normalized_category SET NOT NULL,
    ALTER COLUMN normalized_category SET DEFAULT 'Services'
  `);

  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_normalized_category ON businesses(normalized_category)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_viewport_normalized ON businesses(normalized_category, lat, lng)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_opportunity_filters ON businesses(review_count, rating)');
}
