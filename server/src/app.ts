import express from 'express';
import cors from 'cors';
import type { DB } from './db.js';
import { authRouter } from './auth.js';
import { categoriesRouter } from './categories.js';
import { transactionsRouter } from './transactions.js';
import { errorHandler } from './errors.js';

export function createApp(db: DB) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter(db));
  app.use('/api/categories', categoriesRouter(db));
  app.use('/api', transactionsRouter(db));

  app.use(errorHandler);
  return app;
}
