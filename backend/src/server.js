import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRouter } from './routes/analyzeRoute.js';
import { businessesRouter } from './routes/businessesRoute.js';

dotenv.config();

const app = express();

const corsMiddleware = cors({
  origin: '*',
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

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`StreetScope backend running on ${port}`);
});
