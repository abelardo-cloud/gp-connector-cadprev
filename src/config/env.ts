import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  serviceName: 'gp-connector-cadprev',
  version: '1.0.0',
} as const;
