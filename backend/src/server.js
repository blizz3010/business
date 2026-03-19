import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRouter } from './routes/analyzeRoute.js';
import { businessesRouter } from './routes/businessesRoute.js';
import { opportunityGridRouter } from './routes/opportunityGridRoute.js';
import { ensureBusinessSchemaReady } from './db/index.js';

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

app.use(corsMiddleware);
app.options('*', corsMiddleware);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'StreetScope AI backend' });
});

app.use('/api', analyzeRouter);
app.use('/api', businessesRouter);
app.use('/api', opportunityGridRouter);

app.use((error, _req, res, _next) => {
  if (error?.message?.startsWith('CORS blocked')) {
    return res.status(403).json({ error: 'CORS blocked', details: error.message });
  }
  return res.status(500).json({ error: 'Unhandled server error', details: error?.message ?? 'Unknown error' });
});

const port = process.env.PORT || 4000;

ensureBusinessSchemaReady()
  .then(() => {
    app.listen(port, () => {
      console.log(`StreetScope backend running on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database shape:', error.message);
    process.exit(1);
  });
