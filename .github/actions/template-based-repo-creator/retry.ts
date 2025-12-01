interface ExponentialBackoffOptions {
  baseDelay?: number;
  maxDelay?: number;
  maxRetries?: number;
  jitter?: boolean;
}

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;
}

interface Logger {
  info: (message: any) => void;
  error: (message: any) => void;
}

interface RetryMechanismOptions {
  retry?: ExponentialBackoffOptions;
  circuitBreaker?: CircuitBreakerOptions;
  logger?: Logger;
}

type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface RetryErrorType extends Error {
  originalError: Error;
  attempts: number;
  duration: number;
}

const createRetryError = (
  originalError: Error,
  attempts: number,
  duration: number
): RetryErrorType => {
  const error = new Error(originalError.message) as RetryErrorType;
  error.name = "RetryError";
  error.originalError = originalError;
  error.attempts = attempts;
  error.duration = duration;
  return error;
};

const wait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const createExponentialBackoffRetry = (
  options: ExponentialBackoffOptions = {}
) => {
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 30000;
  const maxRetries = options.maxRetries || 5;
  const jitter = options.jitter ?? true;

  const calculateDelay = (retryCount: number): number => {
    // Calculate exponential delay: 2^retryCount * baseDelay
    let delay = Math.min(maxDelay, Math.pow(2, retryCount) * baseDelay);

    // Add jitter to prevent thundering herd problem
    if (jitter) {
      delay = delay * (0.5 + Math.random());
    }

    return delay;
  };

  const execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    let retries = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (retries >= maxRetries) {
          const message =
            error instanceof Error ? error.message : String(error);
          throw new Error(`Failed after ${retries} retries: ${message}`);
        }

        const delay = calculateDelay(retries);
        await wait(delay);
        retries++;
      }
    }
  };

  return { execute };
};

const createCircuitBreaker = (options: CircuitBreakerOptions = {}) => {
  const failureThreshold = options.failureThreshold || 5;
  const resetTimeout = options.resetTimeout || 60000;

  let failures = 0;
  let state: CircuitBreakerState = "CLOSED";
  let lastFailureTime: number | null = null;

  const execute = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (state === "OPEN") {
      if (
        lastFailureTime !== null &&
        Date.now() - lastFailureTime >= resetTimeout
      ) {
        state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      if (state === "HALF_OPEN") {
        state = "CLOSED";
        failures = 0;
      }
      return result;
    } catch (error) {
      failures++;
      lastFailureTime = Date.now();

      if (failures >= failureThreshold) {
        state = "OPEN";
      }
      throw error;
    }
  };

  return { execute };
};

const createRetryMechanism = (options: RetryMechanismOptions = {}) => {
  const retrier = createExponentialBackoffRetry(options.retry);
  const circuitBreaker = createCircuitBreaker(options.circuitBreaker);
  const logger = options.logger || console;

  const logSuccess = (
    context: Record<string, any>,
    attempts: number,
    startTime: number
  ): void => {
    logger.info({
      event: "retry_success",
      context,
      attempts,
      duration: Date.now() - startTime,
    });
  };

  const logFailure = (
    context: Record<string, any>,
    attempts: number,
    error: unknown
  ): void => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({
      event: "retry_failure",
      context,
      attempts,
      error: errorMessage,
    });
  };

  const execute = async <T>(
    fn: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> => {
    const startTime = Date.now();
    let attempts = 0;

    try {
      return await circuitBreaker.execute(async () => {
        return await retrier.execute(async () => {
          attempts++;
          try {
            const result = await fn();
            logSuccess(context, attempts, startTime);
            return result;
          } catch (error) {
            logFailure(context, attempts, error);
            throw error;
          }
        });
      });
    } catch (error) {
      if (error instanceof Error) {
        throw createRetryError(error, attempts, Date.now() - startTime);
      }
      throw createRetryError(
        new Error(String(error)),
        attempts,
        Date.now() - startTime
      );
    }
  };

  return { execute };
};

const retrySystem = createRetryMechanism({
  retry: {
    baseDelay: 3000, // Start with 2 seconds to give GitHub time to initialize
    maxDelay: 30000,
    maxRetries: 8, // More retries for branch initialization delays
  },
  circuitBreaker: {
    failureThreshold: 10, // Higher threshold since we expect initial failures
    resetTimeout: 60000,
  },
});

export default retrySystem;
