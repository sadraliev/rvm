class RetryError extends Error {
  originalError: Error;
  attempts: number;
  duration: number;

  constructor(originalError: Error, attempts: number, duration: number) {
    super(originalError.message);
    this.name = "RetryError";
    this.originalError = originalError;
    this.attempts = attempts;
    this.duration = duration;
  }
}

interface ExponentialBackoffRetryOptions {
  baseDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  jitter?: boolean;
}

class ExponentialBackoffRetry {
  private baseDelay: number;
  private maxDelay: number;
  private maxRetries: number;
  private jitter: boolean;

  constructor(options: ExponentialBackoffRetryOptions = {}) {
    this.baseDelay = options.baseDelay ?? 1000;
    this.maxDelay = options.maxDelay ?? 30000;
    this.maxRetries = options.maxRetries ?? 5;
    this.jitter = options.jitter ?? true;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let retries = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (retries >= this.maxRetries) {
          throw new Error(
            `Failed after ${retries} retries: ${(error as Error).message}`
          );
        }

        const delay = this.calculateDelay(retries);
        await this.wait(delay);
        retries++;
      }
    }
  }

  private calculateDelay(retryCount: number): number {
    // Calculate exponential delay: 2^retryCount * baseDelay
    let delay = Math.min(
      this.maxDelay,
      Math.pow(2, retryCount) * this.baseDelay
    );

    // Add jitter to prevent thundering herd problem
    if (this.jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return delay;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
}

type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private failureThreshold: number;
  private resetTimeout: number;
  private failures: number;
  private state: CircuitBreakerState;
  private lastFailureTime: number | null;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.failures = 0;
    this.state = "CLOSED";
    this.lastFailureTime = null;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (
        this.lastFailureTime !== null &&
        Date.now() - this.lastFailureTime >= this.resetTimeout
      ) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = "OPEN";
      }
      throw error;
    }
  }
}

interface Logger {
  info: (message: any) => void;
  error: (message: any) => void;
}

interface RetryMechanismOptions {
  retry?: ExponentialBackoffRetryOptions;
  circuitBreaker?: CircuitBreakerOptions;
  logger?: Logger;
}

class RetryMechanism {
  private retrier: ExponentialBackoffRetry;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;

  constructor(options: RetryMechanismOptions = {}) {
    this.retrier = new ExponentialBackoffRetry(options.retry);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.logger = options.logger ?? console;
  }

  async execute<T>(
    fn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.retrier.execute(async () => {
          attempts++;
          try {
            const result = await fn();
            this.logSuccess(context, attempts, startTime);
            return result;
          } catch (error) {
            this.logFailure(context, attempts, error as Error);
            throw error;
          }
        });
      });
    } catch (error) {
      throw new RetryError(error as Error, attempts, Date.now() - startTime);
    }
  }

  private logSuccess(
    context: Record<string, any>,
    attempts: number,
    startTime: number
  ): void {
    this.logger.info({
      event: "retry_success",
      context,
      attempts,
      duration: Date.now() - startTime,
    });
  }

  private logFailure(
    context: Record<string, any>,
    attempts: number,
    error: Error
  ): void {
    this.logger.error({
      event: "retry_failure",
      context,
      attempts,
      error: error.message,
    });
  }
}

const retrySystem: RetryMechanism = new RetryMechanism({
  retry: {
    baseDelay: 3000, // Start with 2 seconds to give GitHub time to initialize
    maxDelay: 30000,
    maxRetries: 5,
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeout: 60000,
  },
});

export default retrySystem;
