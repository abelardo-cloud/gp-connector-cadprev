import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);
const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 1800);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
  throw new Error('CACHE_TTL_SECONDS must be a positive integer');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  cacheTtlSeconds,
  serviceName: 'gp-connector-cadprev',
  version: '1.0.0',
} as const;
