import cors from 'cors';
import express from 'express';
import { healthRouter } from '../routes/health.route.js';

export function createServer(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);

  return app;
}
