import Redis from "ioredis"
import { config } from "../config/index.js"

let redisClient: Redis | null = null
const inMemoryStore: Map<string, { value: string; expiresAt: number }> = new Map()

export function getRedisClient(): Redis | null {
  if (config.environment === "test") {
    return null // Use in-memory store in unit tests for zero external dependency
  }

  if (!redisClient) {
    try {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Fail fast to in-memory fallback
      })

      redisClient.on("error", (err) => {
        // Log once and suppress noise
        if (config.environment !== "test") {
          console.warn(`[Redis] Connection warning: ${err.message}. Using in-memory fallback.`)
        }
      })
    } catch {
      redisClient = null
    }
  }

  return redisClient
}

export async function pingRedis(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false
  try {
    const res = await client.ping()
    return res === "PONG"
  } catch {
    return false
  }
}

/**
 * Stores a hashed refresh token with TTL.
 */
export async function storeRefreshToken(userId: string, token: string, ttlSeconds: number): Promise<void> {
  const key = `refresh:${userId}:${token}`
  const client = getRedisClient()
  if (client) {
    try {
      await client.set(key, "1", "EX", ttlSeconds)
      return
    } catch {
      // Fallback to in-memory
    }
  }

  inMemoryStore.set(key, {
    value: "1",
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Verifies that a refresh token exists and has not been revoked.
 */
export async function verifyRefreshToken(userId: string, token: string): Promise<boolean> {
  const key = `refresh:${userId}:${token}`
  const client = getRedisClient()
  if (client) {
    try {
      const res = await client.get(key)
      return res !== null
    } catch {
      // Fallback to in-memory
    }
  }

  const item = inMemoryStore.get(key)
  if (!item) return false
  if (item.expiresAt < Date.now()) {
    inMemoryStore.delete(key)
    return false
  }
  return true
}

/**
 * Revokes a specific refresh token upon use (token rotation).
 */
export async function revokeRefreshToken(userId: string, token: string): Promise<void> {
  const key = `refresh:${userId}:${token}`
  const client = getRedisClient()
  if (client) {
    try {
      await client.del(key)
    } catch {
      // ignore
    }
  }
  inMemoryStore.delete(key)
}

/**
 * Writes an instant revocation marker to Redis denylist for logout or password change.
 */
export async function revokeUserSessions(userId: string, ttlSeconds: number = 900): Promise<void> {
  const key = `denylist:user:${userId}`
  const client = getRedisClient()
  if (client) {
    try {
      await client.set(key, "1", "EX", ttlSeconds)
      return
    } catch {
      // ignore
    }
  }

  inMemoryStore.set(key, {
    value: "1",
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Checks if a token or user ID has been revoked in the denylist.
 */
export async function isTokenRevoked(userId: string, jti?: string): Promise<boolean> {
  const userKey = `denylist:user:${userId}`
  const jtiKey = jti ? `denylist:jti:${jti}` : null

  const client = getRedisClient()
  if (client) {
    try {
      const userRevoked = await client.get(userKey)
      if (userRevoked) return true
      if (jtiKey) {
        const jtiRevoked = await client.get(jtiKey)
        if (jtiRevoked) return true
      }
      return false
    } catch {
      // fallback
    }
  }

  const uItem = inMemoryStore.get(userKey)
  if (uItem && uItem.expiresAt > Date.now()) return true
  if (jtiKey) {
    const jItem = inMemoryStore.get(jtiKey)
    if (jItem && jItem.expiresAt > Date.now()) return true
  }

  return false
}

/**
 * Publishes an event to a user's SSE channel (events:{userId}) for real-time delivery via API Gateway.
 */
export async function publishUserEvent(
  userId: string,
  event: { type: string; [key: string]: any }
): Promise<number> {
  const channel = `events:${userId}`
  const client = getRedisClient()
  if (client) {
    try {
      return await client.publish(channel, JSON.stringify(event))
    } catch {
      // In-memory or network failure fallback
    }
  }
  return 0
}
