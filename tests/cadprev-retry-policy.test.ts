import { describe, expect, it } from 'vitest';
import {
  CadPrevRetryExhaustedError,
  calculateBackoffDelayMs,
  executeWithCadPrevRetry,
  type CadPrevRetryableErrorClassifier,
} from '../src/cadprev/CadPrevRetryPolicy.js';
import { CadPrevSourceStatus } from '../src/cadprev/CadPrevSourceStatus.js';
import { CadPrevEnteSearchAmbiguityError } from '../src/cadprev/CadPrevEnteSearchResultSelector.js';

const classifier: CadPrevRetryableErrorClassifier = {
  getRetryReason(error: unknown): string | null {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'timeout';
    }

    if (error instanceof Error && error.name === 'BrowserNavigationError') {
      return 'source_unavailable';
    }

    return null;
  },
  getFinalErrorCode(error: unknown): string {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'CADPREV_TIMEOUT';
    }

    if (error instanceof Error && error.name === 'BrowserNavigationError') {
      return 'CADPREV_UNAVAILABLE';
    }

    if (error instanceof CadPrevEnteSearchAmbiguityError) {
      return 'CADPREV_ENTE_AMBIGUOUS';
    }

    if (
      error instanceof Error &&
      error.message === 'CadPrev extract did not contain the expected basic CRP data'
    ) {
      return 'CADPREV_UNEXPECTED_CONTENT';
    }

    return 'CONNECTOR_INTERNAL_ERROR';
  },
};

describe('CadPrev retry policy', () => {
  it('retries timeout errors', async () => {
    let attempts = 0;
    const sleeps: number[] = [];

    const result = await executeWithCadPrevRetry(
      async () => {
        attempts += 1;

        if (attempts === 1) {
          throw createNamedError('TimeoutError', 'Timeout 30000ms exceeded');
        }

        return 'ok';
      },
      classifier,
      createRetryOptions(sleeps),
    );

    expect(result.value).toBe('ok');
    expect(result.metadata.attempt_count).toBe(2);
    expect(result.metadata.retry_reason).toBe('timeout');
    expect(sleeps).toHaveLength(1);
  });

  it('uses increasing backoff delays', async () => {
    const sleeps: number[] = [];

    await expect(
      executeWithCadPrevRetry(
        async () => {
          throw createNamedError('TimeoutError', 'Timeout 30000ms exceeded');
        },
        classifier,
        createRetryOptions(sleeps),
      ),
    ).rejects.toThrow(CadPrevRetryExhaustedError);

    expect(sleeps).toEqual([3000, 6000]);
  });

  it('keeps jitter within the configured limit', () => {
    const delay = calculateBackoffDelayMs(1, {
      initialBackoffMs: 3000,
      maxBackoffMs: 30000,
      jitterMs: 500,
      random: () => 1,
    });

    expect(delay).toBe(3500);
  });

  it('does not retry ambiguous ente errors', async () => {
    const sleeps: number[] = [];

    await expect(
      executeWithCadPrevRetry(
        async () => {
          throw new CadPrevEnteSearchAmbiguityError('Ambiguous ente');
        },
        classifier,
        createRetryOptions(sleeps),
      ),
    ).rejects.toMatchObject({
      metadata: {
        attempt_count: 1,
        final_error_code: 'CADPREV_ENTE_AMBIGUOUS',
      },
    });
    expect(sleeps).toEqual([]);
  });

  it('does not retry deterministic parsing errors', async () => {
    const sleeps: number[] = [];

    await expect(
      executeWithCadPrevRetry(
        async () => {
          throw new Error('CadPrev extract did not contain the expected basic CRP data');
        },
        classifier,
        createRetryOptions(sleeps),
      ),
    ).rejects.toMatchObject({
      metadata: {
        attempt_count: 1,
        final_error_code: 'CADPREV_UNEXPECTED_CONTENT',
      },
    });
    expect(sleeps).toEqual([]);
  });

  it('marks possible source limitation only after repeated transient failures', async () => {
    await expect(
      executeWithCadPrevRetry(
        async () => {
          throw createNamedError('BrowserNavigationError', 'net::ERR_CONNECTION_TIMED_OUT');
        },
        classifier,
        createRetryOptions([]),
      ),
    ).rejects.toMatchObject({
      metadata: {
        attempt_count: 3,
        final_error_code: 'CADPREV_UNAVAILABLE',
        possible_source_limitation: true,
      },
    });
  });

  it('allows source status to return to available after retry success', async () => {
    const sourceStatus = new CadPrevSourceStatus();
    let attempts = 0;

    await executeWithCadPrevRetry(
      async () => {
        attempts += 1;

        if (attempts === 1) {
          throw createNamedError('TimeoutError', 'Timeout 30000ms exceeded');
        }

        return 'ok';
      },
      classifier,
      createRetryOptions([]),
    );
    sourceStatus.markAvailable(new Date('2026-07-10T10:00:00.000Z'));

    expect(sourceStatus.getSnapshot()).toMatchObject({
      status: 'available',
      last_error: null,
    });
  });
});

function createRetryOptions(sleeps: number[]) {
  return {
    retryAttempts: 2,
    initialBackoffMs: 3000,
    maxBackoffMs: 30000,
    jitterMs: 0,
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    logger: () => undefined,
  };
}

function createNamedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;

  return error;
}
