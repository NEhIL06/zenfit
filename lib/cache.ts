/**
 * lib/cache.ts
 * 
 * Upstash Redis cache wrapper for ZenFit.
 * 
 * Design decisions:
 * - Uses @upstash/redis (HTTP-based, serverless-safe — no TCP sockets)
 * - SCAN instead of KEYS for pattern clearing (O(N) non-blocking vs KEYS O(N) blocking)
 * - normalizeKey: strips non-alphanumeric to maximize cache hit rate across LLM name variations
 * - hashKey: SHA-256 of normalized input — deterministic, fixed-length, collision-resistant
 * 
 * Key schema:
 *   global:img:exercise:{sha256}   → Pollinations image URL (30d TTL)
 *   global:img:meal:{sha256}       → Pollinations image URL (30d TTL)
 *   rag:user:{userId}:{sha256}     → Self-RAG JSON response (1h TTL)
 *   chat:general:{sha256}          → General Mistral response string (1h TTL)
 */

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Singleton Redis client
// ---------------------------------------------------------------------------

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      throw new Error(
        '[Cache] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in environment variables.'
      )
    }

    _redis = new Redis({ url, token })
  }
  return _redis
}

// Key helpers

/**
 * Normalize a cache key segment:
 * - Lowercase
 * - Strip all non-alphanumeric characters
 * Ensures "Barbell Bench Press!" and "barbell bench press" hash to the same key.
 */
export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Build a SHA-256 hex hash from one or more string parts.
 * Parts are normalized and joined with ':' before hashing.
 */
export function hashKey(...parts: string[]): string {
  const joined = parts.map(normalizeKey).join(':')
  return crypto.createHash('sha256').update(joined).digest('hex')
}

// Cache operations

/**
 * Get a value from Redis. Returns null on miss or error.
 */
export async function getCache<T = string>(key: string): Promise<T | null> {
  try {
    const redis = getRedis()
    const value = await redis.get<T>(key)
    if (value !== null && value !== undefined) {
      console.log(`[Cache] HIT  ${key}`)
      return value
    }
    console.log(`[Cache] MISS ${key}`)
    return null
  } catch (err) {
    console.error(`[Cache] GET error for key "${key}":`, err)
    return null
  }
}

/**
 * Set a value in Redis with an optional TTL (seconds).
 * Silently fails on error so the API still returns a response.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = getRedis()
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds })
    console.log(`[Cache] SET  ${key} (TTL: ${ttlSeconds}s)`)
  } catch (err) {
    console.error(`[Cache] SET error for key "${key}":`, err)
  }
}

/**
 * Clear all keys matching a prefix pattern using SCAN (non-blocking, production-safe).
 * Uses cursor-based iteration to avoid blocking Redis with KEYS.
 * 
 * Example: clearPattern('rag:user:abc123:*')
 */
export async function clearPattern(pattern: string): Promise<number> {
  try {
    const redis = getRedis()
    let cursor = 0
    let deleted = 0

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: pattern,
        count: 100,
      })
      cursor = Number(nextCursor)

      if (keys.length > 0) {
        await redis.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== 0)

    if (deleted > 0) {
      console.log(`[Cache] CLEAR pattern="${pattern}" deleted=${deleted} keys`)
    }
    return deleted
  } catch (err) {
    console.error(`[Cache] CLEAR error for pattern "${pattern}":`, err)
    return 0
  }
}

// TTL constants (seconds)

export const TTL = {
  /** Exercise/meal images — immutable posture/food content */
  IMAGE: 60 * 60 * 24 * 30,    // 30 days
  /** User-scoped RAG chat responses — personalized, stale after plan regen */
  RAG: 60 * 60,                  // 1 hour
  /** General (non-fitness) chat responses — generic, safe to cache longer */
  GENERAL_CHAT: 60 * 60,         // 1 hour
} as const

// ---------------------------------------------------------------------------
// Typed key builders (prevents typos, centralizes schema)
// ---------------------------------------------------------------------------

export const CacheKeys = {
  exerciseImage: (name: string) =>
    `global:img:exercise:${hashKey(name)}`,

  mealImage: (name: string) =>
    `global:img:meal:${hashKey(name)}`,

  ragResponse: (userId: string, question: string) =>
    `rag:user:${userId}:${hashKey(question)}`,

  generalChat: (message: string) =>
    `chat:general:${hashKey(message)}`,

  userRagPattern: (userId: string) =>
    `rag:user:${userId}:*`,
} as const
