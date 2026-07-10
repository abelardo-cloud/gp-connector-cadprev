export type CadPrevSourceAvailabilityStatus = 'available' | 'degraded' | 'unavailable' | 'unknown';

export type CadPrevSourceErrorOrigin =
  | 'browser_runtime'
  | 'connector_internal'
  | 'connector_network'
  | 'official_source';

export interface CadPrevSourceStatusError {
  code: string;
  message: string;
  origin: CadPrevSourceErrorOrigin;
  possible_source_limitation?: boolean;
}

export interface CadPrevSourceStatusSnapshot {
  source: 'CadPrev Público';
  status: CadPrevSourceAvailabilityStatus;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: CadPrevSourceStatusError | null;
  checked_by: 'observed_query';
  updated_at: string;
}

export class CadPrevSourceStatus {
  private status: CadPrevSourceAvailabilityStatus = 'unknown';
  private lastSuccessAt: string | null = null;
  private lastAttemptAt: string | null = null;
  private lastError: CadPrevSourceStatusError | null = null;
  private updatedAt = new Date().toISOString();

  public getSnapshot(): CadPrevSourceStatusSnapshot {
    return {
      source: 'CadPrev Público',
      status: this.status,
      last_success_at: this.lastSuccessAt,
      last_attempt_at: this.lastAttemptAt,
      last_error: this.lastError,
      checked_by: 'observed_query',
      updated_at: this.updatedAt,
    };
  }

  public markAvailable(now = new Date()): void {
    const timestamp = now.toISOString();

    this.status = 'available';
    this.lastAttemptAt = timestamp;
    this.lastSuccessAt = timestamp;
    this.lastError = null;
    this.updatedAt = timestamp;
  }

  public markUnavailable(error: CadPrevSourceStatusError, now = new Date()): void {
    const timestamp = now.toISOString();

    this.status = 'unavailable';
    this.lastAttemptAt = timestamp;
    this.lastError = error;
    this.updatedAt = timestamp;
  }

  public markDegraded(error: CadPrevSourceStatusError, now = new Date()): void {
    const timestamp = now.toISOString();

    this.status = 'degraded';
    this.lastAttemptAt = timestamp;
    this.lastError = error;
    this.updatedAt = timestamp;
  }

  public reset(now = new Date()): void {
    this.status = 'unknown';
    this.lastSuccessAt = null;
    this.lastAttemptAt = null;
    this.lastError = null;
    this.updatedAt = now.toISOString();
  }
}

export const cadPrevSourceStatus = new CadPrevSourceStatus();
