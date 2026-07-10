import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);
const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS ?? 1800);
const playwrightTimeoutMs = Number(process.env.PLAYWRIGHT_TIMEOUT ?? 120000);
const cadPrevMaxConcurrentRequests = Number(process.env.CADPREV_MAX_CONCURRENT_REQUESTS ?? 1);
const cadPrevMinRequestIntervalMs = Number(process.env.CADPREV_MIN_REQUEST_INTERVAL_MS ?? 10000);
const cadPrevRetryAttempts = Number(process.env.CADPREV_RETRY_ATTEMPTS ?? 2);
const cadPrevRetryBackoffInitialMs = Number(process.env.CADPREV_RETRY_BACKOFF_INITIAL_MS ?? 3000);
const cadPrevRetryBackoffMaxMs = Number(process.env.CADPREV_RETRY_BACKOFF_MAX_MS ?? 30000);
const cadPrevRetryJitterMs = Number(process.env.CADPREV_RETRY_JITTER_MS ?? 500);

if (Number.isNaN(port)) {
  throw new Error('PORT must be a valid number');
}

if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds <= 0) {
  throw new Error('CACHE_TTL_SECONDS must be a positive integer');
}

if (!Number.isInteger(playwrightTimeoutMs) || playwrightTimeoutMs <= 0) {
  throw new Error('PLAYWRIGHT_TIMEOUT must be a positive integer');
}

if (!Number.isInteger(cadPrevMaxConcurrentRequests) || cadPrevMaxConcurrentRequests <= 0) {
  throw new Error('CADPREV_MAX_CONCURRENT_REQUESTS must be a positive integer');
}

if (!Number.isInteger(cadPrevMinRequestIntervalMs) || cadPrevMinRequestIntervalMs < 0) {
  throw new Error('CADPREV_MIN_REQUEST_INTERVAL_MS must be a non-negative integer');
}

if (!Number.isInteger(cadPrevRetryAttempts) || cadPrevRetryAttempts < 0) {
  throw new Error('CADPREV_RETRY_ATTEMPTS must be a non-negative integer');
}

if (!Number.isInteger(cadPrevRetryBackoffInitialMs) || cadPrevRetryBackoffInitialMs < 0) {
  throw new Error('CADPREV_RETRY_BACKOFF_INITIAL_MS must be a non-negative integer');
}

if (!Number.isInteger(cadPrevRetryBackoffMaxMs) || cadPrevRetryBackoffMaxMs < 0) {
  throw new Error('CADPREV_RETRY_BACKOFF_MAX_MS must be a non-negative integer');
}

if (!Number.isInteger(cadPrevRetryJitterMs) || cadPrevRetryJitterMs < 0) {
  throw new Error('CADPREV_RETRY_JITTER_MS must be a non-negative integer');
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port,
  cacheTtlSeconds,
  playwrightTimeoutMs,
  cadPrevMaxConcurrentRequests,
  cadPrevMinRequestIntervalMs,
  cadPrevRetryAttempts,
  cadPrevRetryBackoffInitialMs,
  cadPrevRetryBackoffMaxMs,
  cadPrevRetryJitterMs,
  serviceName: 'gp-connector-cadprev',
  version: '1.0.0',
} as const;
