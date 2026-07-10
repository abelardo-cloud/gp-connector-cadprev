export interface CadPrevRetryPolicyOptions {
  retryAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  jitterMs: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logger?: (event: Record<string, unknown>) => void;
}

export interface CadPrevRetryExecutionResult<TValue> {
  value: TValue;
  metadata: CadPrevRetryMetadata;
}

export interface CadPrevRetryMetadata {
  attempt_count: number;
  retry_reason: string | null;
  retry_delays: number[];
  final_error_code: string | null;
  possible_source_limitation: boolean;
}

export interface CadPrevRetryableErrorClassifier {
  getRetryReason(error: unknown): string | null;
  getFinalErrorCode(error: unknown): string;
}

export class CadPrevRetryExhaustedError extends Error {
  public readonly cause: unknown;
  public readonly metadata: CadPrevRetryMetadata;

  public constructor(cause: unknown, metadata: CadPrevRetryMetadata) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'CadPrevRetryExhaustedError';
    this.cause = cause;
    this.metadata = metadata;
  }
}

export async function executeWithCadPrevRetry<TValue>(
  operation: (attempt: number) => Promise<TValue>,
  classifier: CadPrevRetryableErrorClassifier,
  options: CadPrevRetryPolicyOptions,
  metadata: Record<string, unknown> = {},
): Promise<CadPrevRetryExecutionResult<TValue>> {
  const retryDelays: number[] = [];
  let attempt = 1;
  let lastRetryReason: string | null = null;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = options.logger ?? ((event) => console.info(JSON.stringify(event)));

  while (true) {
    try {
      logger({
        event: 'cadprev_attempt_started',
        attempt,
        ...metadata,
      });

      const value = await operation(attempt);

      logger({
        event: 'cadprev_attempt_finished',
        result: 'success',
        attempt,
        ...metadata,
      });

      return {
        value,
        metadata: {
          attempt_count: attempt,
          retry_reason: lastRetryReason,
          retry_delays: retryDelays,
          final_error_code: null,
          possible_source_limitation: false,
        },
      };
    } catch (error) {
      const retryReason = classifier.getRetryReason(error);
      const canRetry = retryReason !== null && attempt <= options.retryAttempts;

      logger({
        event: 'cadprev_attempt_finished',
        result: 'error',
        attempt,
        retryable: canRetry,
        retry_reason: retryReason,
        error_name: error instanceof Error ? error.name : 'UnknownError',
        error_message: error instanceof Error ? error.message : String(error),
        ...metadata,
      });

      if (!canRetry) {
        const finalErrorCode = classifier.getFinalErrorCode(error);
        const retryMetadata = {
          attempt_count: attempt,
          retry_reason: retryReason ?? lastRetryReason,
          retry_delays: retryDelays,
          final_error_code: finalErrorCode,
          possible_source_limitation: isPossibleSourceLimitation(finalErrorCode, attempt),
        };

        throw new CadPrevRetryExhaustedError(error, retryMetadata);
      }

      lastRetryReason = retryReason;
      const delayMs = calculateBackoffDelayMs(attempt, options);
      retryDelays.push(delayMs);

      logger({
        event: 'cadprev_retry_scheduled',
        attempt,
        next_attempt: attempt + 1,
        wait_ms: delayMs,
        retry_reason: retryReason,
        ...metadata,
      });

      await sleep(delayMs);
      attempt += 1;
    }
  }
}

export function calculateBackoffDelayMs(
  failedAttempt: number,
  options: Pick<CadPrevRetryPolicyOptions, 'initialBackoffMs' | 'jitterMs' | 'maxBackoffMs' | 'random'>,
): number {
  const random = options.random ?? Math.random;
  const exponentialDelay = options.initialBackoffMs * 2 ** Math.max(0, failedAttempt - 1);
  const cappedDelay = Math.min(options.maxBackoffMs, exponentialDelay);
  const jitter = options.jitterMs === 0 ? 0 : Math.floor(random() * options.jitterMs);

  return Math.min(options.maxBackoffMs, cappedDelay + jitter);
}

function isPossibleSourceLimitation(finalErrorCode: string, attemptCount: number): boolean {
  return (
    attemptCount >= 3 &&
    (finalErrorCode === 'CADPREV_TIMEOUT' || finalErrorCode === 'CADPREV_UNAVAILABLE')
  );
}
