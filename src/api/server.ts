import cors from 'cors';
import express from 'express';
import { browserTestRouter } from '../routes/browser-test.route.js';
import { cadPrevRouter } from '../routes/cadprev.route.js';
import { cadPrevTestRouter } from '../routes/cadprev-test.route.js';
import { diagnosticsRouter } from '../routes/diagnostics.route.js';
import { healthRouter } from '../routes/health.route.js';

export function createServer(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(healthRouter);
  app.use(browserTestRouter);
  app.use(cadPrevTestRouter);
  app.use(cadPrevRouter);
  app.use(diagnosticsRouter);

  return app;
}
