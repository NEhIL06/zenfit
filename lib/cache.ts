/**
 * lib/cache.ts
 *
 * Upstash Redis cache wrapper for ZenFit.
 *
 * Design decisions:
 * - @upstash/redis is HTTP-based (serverless-safe — no TCP sockets, no connection pooling issues)
 * - setCache does NOT call JSON.stringify — Upstash SDK auto-serializes objects.
 *   The previous JSON.stringify caused double-serialization: Redis stored a JSON string OF JSON,
 *   making redis.get<T>() return a `string` rather than `T`. Removing it fixes type safety.
 * - SCAN instead of KEYS for pattern clearing (cursor-based O(N), non-blocking vs KEYS blocking)
 * - normalizeKey: strips non-alphanumeric to maximize cache hit rate across LLM name variations
 * - hashKey: SHA-256 of normalized input — deterministic, fixed-length, collision-resistant
 *
 * Key schema:
 *   global:img:exercise:{sha256}   → Image URL or data URI (30d TTL)
 *   global:img:meal:{sha256}       → Image URL or data URI (30d TTL)
 *   rag:user:{userId}:{sha256}     → Self-RAG JSON response (1h TTL)
 *   chat:general:{sha256}          → General Mistral response string (1h TTL)
 *   web:search:{sha256}            → Web search results array (6h TTL)
 */

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      throw new Error(
        '[Cache] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.'
      )
    }

    _redis = new Redis({ url, token })
  }
  return _redis
}

/**
 * Normalize a cache key segment.
 * Lowercase + strip non-alphanumeric — ensures "Barbell Bench Press!" and
 * "barbell bench press" hash to the same key.
 */
export function normalizeKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Build a SHA-256 hex hash from one or more string parts.
 * Parts are normalized and joined with ':' before hashing.
 * Fixed 64-char output — no truncation, no collision risk.
 */
export function hashKey(...parts: string[]): string {
  const joined = parts.map(normalizeKey).join(':')
  return crypto.createHash('sha256').update(joined).digest('hex')
}

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
 * Set a typed value in Redis with a mandatory TTL (seconds).
 *
 * IMPORTANT: Do NOT wrap `value` in JSON.stringify before passing.
 * @upstash/redis serializes objects automatically. Double-serializing causes
 * redis.get<T>() to return a raw JSON string instead of the typed T.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = getRedis()
    // Pass value directly — Upstash SDK handles serialization
    await redis.set(key, value as any, { ex: ttlSeconds })
    console.log(`[Cache] SET  ${key} (TTL: ${ttlSeconds}s)`)
  } catch (err) {
    console.error(`[Cache] SET error for key "${key}":`, err)
  }
}

/**
 * Clear all keys matching a pattern using cursor-based SCAN (non-blocking).
 * Safe for production — does not block Redis like KEYS does.
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

export const TTL = {
  IMAGE: 60 * 60 * 24 * 30,    // 30 days
  RAG: 60 * 60,                  // 1 hour
  GENERAL_CHAT: 60 * 60,         // 1 hour
  WEB_SEARCH: 60 * 60 * 6,       // 6 hours
} as const

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

  webSearch: (query: string) =>
    `web:search:${hashKey(query)}`,
} as const
