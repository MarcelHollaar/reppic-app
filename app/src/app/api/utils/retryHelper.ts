/**
 * Retry helper with exponential backoff and timeout handling
 * Used for external API calls that may fail temporarily
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
  // Context information for error notifications
  operation?: string;
  conversationId?: string;
  userId?: string;
  userName?: string;
  filePath?: string;
  sendErrorEmail?: boolean; // Whether to send error email on failure (default: true)
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  lastError?: Error;
}

/**
 * Classifies if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors (no response)
  if (!error.response && !error.status) {
    return true; // Network timeout, connection refused, etc.
  }

  // HTTP status codes
  const status = error.response?.status || error.status;
  
  // 5xx errors (server errors) - retryable
  if (status >= 500 && status < 600) {
    return true;
  }

  // 429 (Rate limit) - retryable
  if (status === 429) {
    return true;
  }

  // 408 (Request timeout) - retryable
  if (status === 408) {
    return true;
  }

  // 4xx errors (client errors) - generally not retryable
  // Except 429 which we already handled
  if (status >= 400 && status < 500) {
    return false;
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return true;
  }

  // Connection errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return true;
  }

  return false;
}

/**
 * Creates a timeout promise that rejects after specified time
 */
function createTimeout(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

/**
 * Retries a function with exponential backoff and timeout
 * 
 * @param fn - Function to retry (should return a Promise)
 * @param options - Retry configuration
 * @returns Promise that resolves with the result or rejects after all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 5,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    timeoutMs = 30000, // 30 seconds default timeout
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Race between the function and timeout
      const result = await Promise.race([
        fn(),
        createTimeout(timeoutMs),
      ]);

      // If we get here, the function succeeded
      if (attempt > 0) {
        console.log(`[RetryHelper] Success after ${attempt} retry attempts`);
      }
      return result as T;
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const retryable = isRetryableError(error);

      // If not retryable or we've exhausted retries, send email and throw
      if (!retryable || attempt >= maxRetries) {
        if (!retryable) {
          console.log(`[RetryHelper] Non-retryable error (attempt ${attempt + 1}):`, error.message);
        } else {
          console.log(`[RetryHelper] Max retries (${maxRetries}) exceeded`);
        }
        
        // Send error notification email if enabled and operation context is provided
        if (options.sendErrorEmail !== false && options.operation) {
          try {
            const { mailService } = await import('../services/mailService');
            const httpStatus = error.response?.status || error.status;
            let errorResponse: string | undefined;
            
            // Try to extract error response body if available
            try {
              if (error.response?.data) {
                errorResponse = typeof error.response.data === 'string' 
                  ? error.response.data 
                  : JSON.stringify(error.response.data);
              } else if (error.response?.text) {
                errorResponse = error.response.text;
              }
            } catch (e) {
              // Ignore errors extracting response
            }
            
            await mailService.sendTwinAIErrorNotification({
              error: error as Error,
              operation: options.operation,
              conversationId: options.conversationId,
              userId: options.userId,
              userName: options.userName,
              filePath: options.filePath,
              attempts: attempt + 1,
              errorStack: error.stack,
              httpStatus,
              errorResponse,
            });
          } catch (emailError) {
            // Don't let email failures break the error flow
            console.error('[RetryHelper] Failed to send error notification email:', emailError);
          }
        }
        
        throw error;
      }

      // Log retry attempt
      const status = error.response?.status || error.status || 'network error';
      console.warn(
        `[RetryHelper] Attempt ${attempt + 1}/${maxRetries + 1} failed (${status}): ${error.message}. Retrying in ${delay}ms...`
      );

      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay for next retry (exponential backoff)
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed: unknown error');
}

/**
 * Retries a function and returns a result object instead of throwing
 * Useful when you want to handle failures gracefully
 */
export async function withRetrySafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  try {
    const data = await withRetry(fn, options);
    return {
      success: true,
      data,
      attempts: 1,
    };
  } catch (error: any) {
    const attempts = (options.maxRetries || 5) + 1;
    return {
      success: false,
      error: error as Error,
      attempts,
      lastError: error as Error,
    };
  }
}

