/**
 * Retry utility with exponential backoff.
 */

import { Logger } from './logger.js';

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3. */
  maxAttempts?: number;
  /** Initial delay in ms before the first retry. Default: 500. */
  initialDelayMs?: number;
  /** Multiplier applied to the delay after each retry. Default: 2. */
  backoffFactor?: number;
  /** Maximum delay in ms. Default: 10000. */
  maxDelayMs?: number;
  /** Optional logger instance. */
  logger?: Logger;
}

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn   The async function to attempt.
 * @param opts Retry configuration.
 * @returns    The result of `fn` on a successful attempt.
 * @throws     The last error after all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    backoffFactor = 2,
    maxDelayMs = 10_000,
    logger: log,
  } = opts;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const msg = err instanceof Error ? err.message : String(err);
      log?.warn(`Attempt ${attempt}/${maxAttempts} failed: ${msg}. Retrying in ${delay}ms…`);

      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }

  throw lastError;
}

/** Promise-based sleep. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
