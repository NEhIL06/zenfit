import { Request, Response, NextFunction } from "express"
import { getRedisClient } from "../db/redis.js"
import { config } from "../config/index.js"

interface RateLimitRecord {
  count: number
  resetAt: number
}

const memoryRateLimitStore: Map<string, RateLimitRecord> = new Map()

export function createRateLimiter(limit: number = 10, windowSec: number = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (config.environment === "test") {
      return next() // Disable rate limiting in unit test suite
    }

    const ip = (req.headers["x-real-ip"] as string) || (req.headers["x-forwarded-for"] as string) || req.ip || "unknown"
    const key = `ratelimit:auth:${ip}`

    const redis = getRedisClient()
    if (redis) {
      try {
        const current = await redis.incr(key)
        if (current === 1) {
          await redis.expire(key, windowSec)
        }
        if (current > limit) {
          res.status(429).json({
            error: "Too Many Requests",
            message: "Too many attempts. Please wait a moment and try again.",
            code: "RATE_LIMIT_EXCEEDED",
            requestId: req.requestId,
          })
          return
        }
        return next()
      } catch {
        // Fallback to in-memory
      }
    }

    // In-memory sliding window fallback
    const now = Date.now()
    const record = memoryRateLimitStore.get(key)

    if (!record || record.resetAt < now) {
      memoryRateLimitStore.set(key, { count: 1, resetAt: now + windowSec * 1000 })
      return next()
    }

    record.count += 1
    if (record.count > limit) {
      res.status(429).json({
        error: "Too Many Requests",
        message: "Too many attempts. Please wait a moment and try again.",
        code: "RATE_LIMIT_EXCEEDED",
        requestId: req.requestId,
      })
      return
    }

    return next()
  }
}
