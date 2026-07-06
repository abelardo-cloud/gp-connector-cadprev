import { Router, type IRouter } from 'express';
import { env } from '../config/env.js';

export const healthRouter: IRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: env.serviceName,
    version: env.version,
  });
});
