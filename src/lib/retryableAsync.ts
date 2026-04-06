/**
 * retryableAsync.ts
 *
 * Implements exponential backoff retry logic for API calls.
 * Used to gracefully handle transient failures (network hiccups, rate limits, etc.)
 * without surfacing errors to the user unnecessarily.
 *
 * Features:
 * - Configurable retry count (default 3)
 * - Exponential backoff: delay = baseDelay * (2 ^ attemptNumber)
 * - Logs retry attempts for debugging
 * - Only retries transient failures (network errors, 408, and 5xx). Never retries 4xx.
 */

/**
 * Retry configuration object
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number
  /**
   * Which HTTP status codes to retry on.
   *
   * Default: [408, 500, 502, 503, 504]
   *
   * Note: We intentionally do NOT retry 4xx (including 429) because retrying client
   * errors tends to amplify rate limits and produce noisy logs.
   */
  retryableStatuses?: number[]
}

/**
 * Error that includes HTTP status code (for retry logic)
 */
interface HttpError extends Error {
  status?: number
}

/**
 * Wraps an async function with exponential backoff retry logic.
 *
 * @param fn Async function to retry
 * @param config Retry configuration
 * @returns Promise that resolves/rejects after retry attempts exhausted
 *
 * @example
 * const data = await retryableAsync(
 *   () => fetch('/api/data'),
 *   { maxAttempts: 3, baseDelayMs: 100 }
 * )
 */
export async function retryableAsync<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const maxAttempts = config.maxAttempts ?? 3
  const baseDelayMs = config.baseDelayMs ?? 100
  const retryableStatuses = config.retryableStatuses ?? [408, 500, 502, 503, 504]

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      const httpError = error as HttpError

      // Check if this error is retryable
      const isRetryable =
        attempt < maxAttempts - 1 && // not the last attempt
        (!httpError.status || retryableStatuses.includes(httpError.status)) // retryable status

      if (!isRetryable) {
        throw error
      }

      // Calculate exponential backoff delay: baseDelay * (2 ^ attemptNumber)
      const delayMs = baseDelayMs * Math.pow(2, attempt)

      // eslint-disable-next-line no-console
      console.warn(
        `Attempt ${attempt + 1} failed (${httpError.status || 'network error'}), retrying in ${delayMs}ms...`,
        httpError.message
      )

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError || new Error('Retry exhausted')
}
