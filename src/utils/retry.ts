interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2 } = options

  let lastError: Error | null = null
  let delay = initialDelay

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't wait after the last attempt
      if (attempt === maxRetries - 1) break

      // Wait for the calculated delay
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw lastError
}