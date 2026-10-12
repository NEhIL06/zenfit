"""High-performance Redis Service for ZenFit AI Engine.
Provides caching, distributed idempotency locks, and Pub/Sub event broadcasting (events:{userId}).
Includes fail-safe in-memory fallback for local testing and resilience.
"""

import json
import fnmatch
import time
from typing import Optional, Any, Dict
import redis
from app.config import settings
from app.core.logger import logger


class RedisService:
    """Manages Redis connection, cache operations, distributed locks, and SSE event publishing."""

    def __init__(self, redis_url: Optional[str] = None):
        self.url = redis_url or settings.REDIS_URL
        self._client: Optional[redis.Redis] = None
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._last_failed_attempt: float = 0.0
        self._cooldown_sec: float = 15.0

    @property
    def client(self) -> Optional[redis.Redis]:
        if self._client is None:
            if time.time() - self._last_failed_attempt < self._cooldown_sec:
                return None
            try:
                self._client = redis.Redis.from_url(
                    self.url,
                    decode_responses=True,
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                    protocol=2,
                )
                self._client.ping()
                logger.info(f"[RedisService] Connected to Redis at {self.url}")
            except Exception as e:
                self._last_failed_attempt = time.time()
                logger.warning(f"[RedisService] Redis connection failed ({e}). Using in-memory fallback (cooldown {self._cooldown_sec}s).")
                self._client = None
        return self._client

    def ping(self) -> bool:
        """Checks if live Redis server is reachable."""
        try:
            c = self.client
            return bool(c and c.ping())
        except Exception:
            return False

    def get_cache(self, key: str) -> Optional[str]:
        """Fetches string/JSON value from Redis cache."""
        try:
            if self.client:
                return self.client.get(key)
        except Exception as e:
            logger.warning(f"[RedisService] get_cache error: {e}")

        # In-memory fallback
        item = self._memory_cache.get(key)
        if item:
            if item["expires_at"] is None or item["expires_at"] > time.time():
                return item["value"]
            del self._memory_cache[key]
        return None

    def set_cache(self, key: str, value: str, ttl: int = 3600) -> bool:
        """Sets a cached key with TTL in seconds."""
        try:
            if self.client:
                self.client.set(key, value, ex=ttl)
                return True
        except Exception as e:
            logger.warning(f"[RedisService] set_cache error: {e}")

        # In-memory fallback
        self._memory_cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl if ttl else None,
        }
        return True

    def clear_pattern(self, pattern: str) -> int:
        """Deletes all keys matching a glob pattern."""
        deleted = 0
        try:
            if self.client:
                keys = self.client.keys(pattern)
                if keys:
                    deleted = self.client.delete(*keys)
                    return deleted
        except Exception as e:
            logger.warning(f"[RedisService] clear_pattern error: {e}")

        # In-memory fallback
        keys_to_del = [k for k in self._memory_cache if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_del:
            del self._memory_cache[k]
            deleted += 1
        return deleted

    def acquire_idempotency_lock(self, user_id: str, idempotency_key: str, ttl: int = 120) -> bool:
        """Acquires a distributed lock using SET NX EX.
        Implements Section 10.3 Distributed Idempotency to prevent duplicate LLM jobs.
        """
        lock_key = f"idempotency:plan:{user_id}:{idempotency_key}"
        try:
            if self.client:
                # Returns True if key was set (i.e. did not previously exist)
                acquired = self.client.set(lock_key, "PENDING", nx=True, ex=ttl)
                return bool(acquired)
        except Exception as e:
            logger.warning(f"[RedisService] acquire_idempotency_lock error: {e}")

        # In-memory fallback
        now = time.time()
        existing = self._memory_cache.get(lock_key)
        if existing and (existing["expires_at"] is None or existing["expires_at"] > now):
            return False
        self._memory_cache[lock_key] = {"value": "PENDING", "expires_at": now + ttl}
        return True

    def publish_event(self, user_id: str, payload: Dict[str, Any]) -> int:
        """Publishes an event to the user's private Redis channel (events:{userId}).
        Subscribed to by the Go API Gateway's embedded SSE Hub (GET /v1/events).
        """
        channel = f"events:{user_id}"
        message = json.dumps(payload)
        try:
            if self.client:
                subscribers = self.client.publish(channel, message)
                logger.info(f"[RedisService] Published to {channel} ({subscribers} active subscribers): {payload.get('type')}")
                return subscribers
        except Exception as e:
            logger.error(f"[RedisService] Failed to publish event to {channel}: {e}")
        return 0


# Singleton instance
redis_service = RedisService()
