import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/cache/MemoryCache.js';

describe('MemoryCache', () => {
  it('returns cached values before TTL expiration', () => {
    const cache = new MemoryCache<string>();

    cache.set('key', 'value', 60);

    expect(cache.get('key')).toBe('value');
  });

  it('expires cached values after TTL', () => {
    vi.useFakeTimers();

    try {
      const cache = new MemoryCache<string>();

      cache.set('key', 'value', 1);
      vi.advanceTimersByTime(1000);

      expect(cache.get('key')).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
