import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { CATEGORY_SQL_CASE, SUBCATEGORY_SQL_CASE } from '../services/categoryService.js';

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
  // Ensure normalized_category column exists
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

  // Ensure subcategory column exists
  await pgPool.query(`
    ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS subcategory TEXT
  `);

  await pgPool.query(`
    UPDATE businesses
    SET subcategory = ${SUBCATEGORY_SQL_CASE}
    WHERE subcategory IS NULL
  `);

  await pgPool.query(`
    ALTER TABLE businesses
    ALTER COLUMN subcategory SET NOT NULL,
    ALTER COLUMN subcategory SET DEFAULT 'Services'
  `);

  // Create all indexes
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_normalized_category ON businesses(normalized_category)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_subcategory ON businesses(subcategory)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_viewport_normalized ON businesses(normalized_category, lat, lng)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_viewport_subcategory ON businesses(subcategory, lat, lng)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_opportunity_filters ON businesses(review_count, rating)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_businesses_name_lower ON businesses(LOWER(name))');

  // ── Auth & user tables ──────────────────────────────────────────────────
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)');
  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)');

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS saved_businesses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      place_id TEXT NOT NULL,
      business_name TEXT NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, place_id)
    )
  `);

  await pgPool.query('CREATE INDEX IF NOT EXISTS idx_saved_businesses_user ON saved_businesses(user_id)');
}
