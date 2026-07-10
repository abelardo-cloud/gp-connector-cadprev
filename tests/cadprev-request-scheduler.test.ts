import { describe, expect, it } from 'vitest';
import { CadPrevRequestScheduler } from '../src/cadprev/CadPrevRequestScheduler.js';

describe('CadPrevRequestScheduler', () => {
  it('runs only one external request at a time', async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const releaseFirstTask = createDeferred<void>();
    const scheduler = new CadPrevRequestScheduler({
      maxConcurrentRequests: 1,
      minRequestIntervalMs: 0,
      logger: () => undefined,
    });

    const firstTask = scheduler.schedule(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await releaseFirstTask.promise;
      activeRequests -= 1;
      return 'first';
    });
    const secondTask = scheduler.schedule(async () => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      activeRequests -= 1;
      return 'second';
    });

    await Promise.resolve();
    releaseFirstTask.resolve();

    await expect(Promise.all([firstTask, secondTask])).resolves.toEqual(['first', 'second']);
    expect(maxActiveRequests).toBe(1);
  });

  it('respects the minimum interval between real request starts', async () => {
    let now = 1000;
    const waits: number[] = [];
    const scheduler = new CadPrevRequestScheduler({
      maxConcurrentRequests: 1,
      minRequestIntervalMs: 10000,
      now: () => now,
      sleep: async (ms) => {
        waits.push(ms);
        now += ms;
      },
      logger: () => undefined,
    });

    await scheduler.schedule(async () => 'first');
    await scheduler.schedule(async () => 'second');

    expect(waits).toEqual([10000]);
  });

  it('serializes different ente queries through the same queue', async () => {
    const starts: string[] = [];
    const releaseFirstTask = createDeferred<void>();
    const scheduler = new CadPrevRequestScheduler({
      maxConcurrentRequests: 1,
      minRequestIntervalMs: 0,
      logger: () => undefined,
    });

    const firstTask = scheduler.schedule(
      async () => {
        starts.push('Acre');
        await releaseFirstTask.promise;
        return 'Acre';
      },
      { query_value: 'Acre' },
    );
    const secondTask = scheduler.schedule(
      async () => {
        starts.push('Bahia');
        return 'Bahia';
      },
      { query_value: 'Bahia' },
    );

    await Promise.resolve();
    expect(starts).toEqual(['Acre']);

    releaseFirstTask.resolve();

    await expect(Promise.all([firstTask, secondTask])).resolves.toEqual(['Acre', 'Bahia']);
    expect(starts).toEqual(['Acre', 'Bahia']);
  });
});

function createDeferred<TValue>() {
  let resolve!: (value: TValue) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<TValue>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}
