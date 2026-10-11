import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimitInstance: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (!ratelimitInstance) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (url && token) {
      try {
        const redis = new Redis({ url, token })
        ratelimitInstance = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(20, '60 s'), // 20 requests per minute per IP/User
          analytics: true,
        })
      } catch (e) {
        console.warn('[RateLimiter] Failed to initialize Upstash Ratelimit:', e)
      }
    }
  }
  return ratelimitInstance
}

/**
 * Checks rate limit for an identifier (e.g. userId or IP).
 * Returns true if allowed, false if rate limited.
 */
export async function checkRateLimit(identifier: string): Promise<{ success: boolean; limit?: number; remaining?: number; reset?: number }> {
  const limiter = getRatelimit()
  if (!limiter) {
    // If Redis is not configured, pass through
    return { success: true }
  }

  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    console.error('[RateLimiter] Rate limit error:', error)
    return { success: true } // Fail open to avoid blocking users if Redis experiences an outage
  }
}
