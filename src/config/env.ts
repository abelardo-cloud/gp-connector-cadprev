import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);
const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 1800);
const playwrightTimeoutMs = Number(process.env.PLAYWRIGHT_TIMEOUT ?? 120000);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
  throw new Error('CACHE_TTL_SECONDS must be a positive integer');
}

if (!Number.isInteger(playwrightTimeoutMs) || playwrightTimeoutMs <= 0) {
  throw new Error('PLAYWRIGHT_TIMEOUT must be a positive integer');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  cacheTtlSeconds,
  playwrightTimeoutMs,
  serviceName: 'gp-connector-cadprev',
  version: '1.0.0',
} as const;
