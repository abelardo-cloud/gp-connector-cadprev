interface CacheEntry<TValue> {
  value: TValue;
  expiresAt: number;
}

export class MemoryCache<TValue> {
  private readonly entries = new Map<string, CacheEntry<TValue>>();

  public get(key: string): TValue | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: string, value: TValue, ttlSeconds: number): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public clear(): void {
    this.entries.clear();
  }
}
