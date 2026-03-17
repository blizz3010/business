import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { analyzeRouter } from './routes/analyzeRoute.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'StreetScope AI backend' });
});

app.use('/', analyzeRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`StreetScope backend running on ${port}`);
});
