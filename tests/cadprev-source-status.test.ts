import { describe, expect, it } from 'vitest';
import { createServer } from '../src/api/server.js';
import { CadPrevSourceStatus, cadPrevSourceStatus } from '../src/cadprev/CadPrevSourceStatus.js';
import {
  createCadPrevUnavailableResponse,
  isSourceUnavailableError,
  isUnexpectedCadPrevContentError,
  resolveUnavailableErrorOrigin,
} from '../src/routes/cadprev.route.js';

describe('CadPrevSourceStatus', () => {
  it('starts as unknown', () => {
    const sourceStatus = new CadPrevSourceStatus();
    const snapshot = sourceStatus.getSnapshot();

    expect(snapshot).toMatchObject({
      source: 'CadPrev Público',
      status: 'unknown',
      last_success_at: null,
      last_attempt_at: null,
      last_error: null,
      checked_by: 'observed_query',
    });
    expect(snapshot.updated_at).toEqual(expect.any(String));
  });

  it('marks successful observed queries as available', () => {
    const sourceStatus = new CadPrevSourceStatus();
    const now = new Date('2026-07-10T10:00:00.000Z');

    sourceStatus.markAvailable(now);

    expect(sourceStatus.getSnapshot()).toMatchObject({
      status: 'available',
      last_success_at: now.toISOString(),
      last_attempt_at: now.toISOString(),
      last_error: null,
      updated_at: now.toISOString(),
    });
  });

  it('marks timeout as unavailable and preserves last success', () => {
    const sourceStatus = new CadPrevSourceStatus();
    const successAt = new Date('2026-07-10T10:00:00.000Z');
    const failureAt = new Date('2026-07-10T10:05:00.000Z');

    sourceStatus.markAvailable(successAt);
    sourceStatus.markUnavailable(
      {
        code: 'CADPREV_TIMEOUT',
        message: 'O CadPrev Público não respondeu dentro do tempo limite.',
        origin: 'browser_runtime',
      },
      failureAt,
    );

    expect(sourceStatus.getSnapshot()).toMatchObject({
      status: 'unavailable',
      last_success_at: successAt.toISOString(),
      last_attempt_at: failureAt.toISOString(),
      last_error: {
        code: 'CADPREV_TIMEOUT',
        origin: 'browser_runtime',
      },
    });
  });

  it('marks unexpected content as degraded and not unavailable', () => {
    const sourceStatus = new CadPrevSourceStatus();
    const successAt = new Date('2026-07-10T10:00:00.000Z');
    const failureAt = new Date('2026-07-10T10:05:00.000Z');

    sourceStatus.markAvailable(successAt);
    sourceStatus.markDegraded(
      {
        code: 'CADPREV_UNEXPECTED_CONTENT',
        message: 'O CadPrev Público respondeu com conteúdo insuficiente ou inesperado.',
        origin: 'official_source',
      },
      failureAt,
    );

    expect(sourceStatus.getSnapshot()).toMatchObject({
      status: 'degraded',
      last_success_at: successAt.toISOString(),
      last_attempt_at: failureAt.toISOString(),
      last_error: {
        code: 'CADPREV_UNEXPECTED_CONTENT',
        origin: 'official_source',
      },
    });
  });

  it('new success after failure returns to available and clears last error', () => {
    const sourceStatus = new CadPrevSourceStatus();
    const successAt = new Date('2026-07-10T10:10:00.000Z');

    sourceStatus.markUnavailable({
      code: 'CADPREV_UNAVAILABLE',
      message: 'O CadPrev Público encontra-se indisponível no momento.',
      origin: 'connector_network',
    });
    sourceStatus.markAvailable(successAt);

    expect(sourceStatus.getSnapshot()).toMatchObject({
      status: 'available',
      last_success_at: successAt.toISOString(),
      last_attempt_at: successAt.toISOString(),
      last_error: null,
    });
  });
});

describe('CadPrev source status route', () => {
  it('returns the observed source status contract', async () => {
    cadPrevSourceStatus.reset(new Date('2026-07-10T10:00:00.000Z'));
    const app = createServer();
    const server = app.listen(0);
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve server address');
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/cadprev/source-status`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({
        source: 'CadPrev Público',
        status: 'unknown',
        last_success_at: null,
        last_attempt_at: null,
        last_error: null,
        checked_by: 'observed_query',
        updated_at: '2026-07-10T10:00:00.000Z',
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      cadPrevSourceStatus.reset();
    }
  });

  it('keeps GET /health independent from CadPrev status', async () => {
    cadPrevSourceStatus.markUnavailable({
      code: 'CADPREV_UNAVAILABLE',
      message: 'O CadPrev Público encontra-se indisponível no momento.',
      origin: 'connector_network',
    });
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
      expect(body.status).toBe('ok');
      expect(body.service).toBe('gp-connector-cadprev');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      cadPrevSourceStatus.reset();
    }
  });
});

describe('CadPrev error classification', () => {
  it('classifies BrowserNavigationError with ERR_CONNECTION_TIMED_OUT as unavailable', () => {
    const error = new Error(
      'page.goto: net::ERR_CONNECTION_TIMED_OUT at https://cadprev.previdencia.gov.br',
    );
    error.name = 'BrowserNavigationError';

    expect(isSourceUnavailableError(error)).toBe(true);
    expect(resolveUnavailableErrorOrigin(error)).toBe('browser_runtime');
    expect(createCadPrevUnavailableResponse(error)).toMatchObject({
      status: 'error',
      source: 'CadPrev Público',
      code: 'CADPREV_UNAVAILABLE',
      error_origin: 'browser_runtime',
    });
  });

  it('classifies fetch connection failure as unavailable', () => {
    const error = new TypeError('fetch failed');

    expect(isSourceUnavailableError(error)).toBe(true);
    expect(resolveUnavailableErrorOrigin(error)).toBe('connector_network');
  });

  it('recognizes unexpected CadPrev content as degraded input', () => {
    const error = new Error('CadPrev extract did not contain the expected basic CRP data');

    expect(isUnexpectedCadPrevContentError(error)).toBe(true);
  });
});
