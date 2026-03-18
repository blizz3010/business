import pg from 'pg';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export const redis = new Redis(process.env.REDIS_URL);
