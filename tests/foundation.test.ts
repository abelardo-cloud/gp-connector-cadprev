import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { createServer } from '../src/api/server.js';

describe('foundation', () => {
  it('loads environment configuration', () => {
    expect(env.serviceName).toBe('gp-connector-cadprev');
    expect(env.version).toBe('1.0.0');
  });

  it('exposes GET /health', async () => {
    const app = createServer();
    const server = app.listen(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        status: 'ok',
        service: 'gp-connector-cadprev',
        version: '1.0.0',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
