export interface CadPrevRequestSchedulerOptions {
  maxConcurrentRequests: number;
  minRequestIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logger?: (event: Record<string, unknown>) => void;
}

export interface CadPrevScheduledTaskContext {
  queue_position: number;
  waited_ms: number;
}

interface QueuedTask<TValue> {
  metadata: Record<string, unknown>;
  queuePosition: number;
  resolve: (value: TValue) => void;
  reject: (error: unknown) => void;
  task: (context: CadPrevScheduledTaskContext) => Promise<TValue>;
}

export class CadPrevRequestScheduler {
  private readonly maxConcurrentRequests: number;
  private readonly minRequestIntervalMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly logger: (event: Record<string, unknown>) => void;
  private readonly queue: Array<QueuedTask<unknown>> = [];
  private activeRequests = 0;
  private lastStartedAt = 0;
  private isProcessing = false;

  public constructor(options: CadPrevRequestSchedulerOptions) {
    this.maxConcurrentRequests = options.maxConcurrentRequests;
    this.minRequestIntervalMs = options.minRequestIntervalMs;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.logger = options.logger ?? ((event) => console.info(JSON.stringify(event)));
  }

  public schedule<TValue>(
    task: (context: CadPrevScheduledTaskContext) => Promise<TValue>,
    metadata: Record<string, unknown> = {},
  ): Promise<TValue> {
    const queuePosition = this.queue.length + this.activeRequests + 1;

    this.logger({
      event: 'cadprev_request_queued',
      queue_position: queuePosition,
      ...metadata,
    });

    return new Promise<TValue>((resolve, reject) => {
      this.queue.push({
        metadata,
        queuePosition,
        resolve: resolve as (value: unknown) => void,
        reject,
        task: task as (context: CadPrevScheduledTaskContext) => Promise<unknown>,
      });
      void this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
        const queuedTask = this.queue.shift();

        if (!queuedTask) {
          continue;
        }

        this.activeRequests += 1;
        void this.runTask(queuedTask).finally(() => {
          this.activeRequests -= 1;
          void this.processQueue();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async runTask<TValue>(queuedTask: QueuedTask<TValue>): Promise<void> {
    const elapsedSinceLastStart = this.lastStartedAt === 0 ? Infinity : this.now() - this.lastStartedAt;
    const waitMs =
      elapsedSinceLastStart === Infinity
        ? 0
        : Math.max(0, this.minRequestIntervalMs - elapsedSinceLastStart);

    if (waitMs > 0) {
      this.logger({
        event: 'cadprev_request_waiting',
        wait_ms: waitMs,
        queue_position: queuedTask.queuePosition,
        ...queuedTask.metadata,
      });
      await this.sleep(waitMs);
    }

    this.lastStartedAt = this.now();
    this.logger({
      event: 'cadprev_request_started',
      queue_position: queuedTask.queuePosition,
      waited_ms: waitMs,
      ...queuedTask.metadata,
    });

    try {
      const result = await queuedTask.task({
        queue_position: queuedTask.queuePosition,
        waited_ms: waitMs,
      });

      this.logger({
        event: 'cadprev_request_finished',
        result: 'success',
        queue_position: queuedTask.queuePosition,
        ...queuedTask.metadata,
      });
      queuedTask.resolve(result);
    } catch (error) {
      this.logger({
        event: 'cadprev_request_finished',
        result: 'error',
        queue_position: queuedTask.queuePosition,
        error_name: error instanceof Error ? error.name : 'UnknownError',
        error_message: error instanceof Error ? error.message : String(error),
        ...queuedTask.metadata,
      });
      queuedTask.reject(error);
    }
  }
}
