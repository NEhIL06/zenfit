"""Global Semantic Retrieval Cache via Redis VSS (Passage-ID Pointers).
Implements Section 3.1 & Section 8e of ZenFit Architecture Specification:
1. RediSearch HNSW vector index (M=16, EF_construction=200, 768-dim, COSINE metric).
2. Querying @scope:{public} with distance cutoff D <= 0.08 (Similarity >= 0.92).
3. Passage-ID pointers: Caches verified parent document IDs with rolling 7-day TTL.
4. Enforces strict RediSearch VSS requirement on live Redis, raising configuration error if missing.
5. Non-blocking user cache eviction via SCAN + UNLINK in batches of 100.
"""

import json
import time
import hashlib
from typing import List, Dict, Any, Optional, Tuple
import redis
from app.config import settings
from app.core.logger import logger
from app.services.embedding_service import embedding_service, pack_vector_to_bytes, cosine_distance
from app.services.redis_service import redis_service


class RedisVSSService:
    """Manages Redis Vector Similarity Search (RediSearch) and Parent Document Store."""

    def __init__(self, index_name: Optional[str] = None):
        self.index_name = index_name or settings.REDIS_VSS_INDEX
        self.dim = settings.REDIS_VSS_DIM
        self.distance_threshold = settings.REDIS_VSS_DISTANCE_THRESHOLD  # 0.08
        self.ttl_sec = settings.REDIS_VSS_TTL_SEC  # 7 days
        self._initialized = False

        # In-memory test store used strictly when ENVIRONMENT == "test"
        self._test_vectors: Dict[str, Dict[str, Any]] = {}
        self._test_parent_docstore: Dict[str, Dict[str, Any]] = {}

    def _ensure_vss_index(self, client: redis.Redis) -> None:
        """Ensures the RediSearch HNSW index exists on the Redis instance.
        Enforces strict RediSearch support: raises RuntimeError if FT commands missing.
        """
        if self._initialized:
            return

        if settings.ENVIRONMENT == "test":
            self._initialized = True
            return

        try:
            # Check if index already exists
            try:
                client.execute_command("FT.INFO", self.index_name)
                self._initialized = True
                logger.info(f"[RedisVSS] RediSearch index '{self.index_name}' already exists.")
                return
            except redis.ResponseError as re_err:
                msg = str(re_err).lower()
                if "unknown command" in msg:
                    raise RuntimeError("Redis instance does not support RediSearch VSS (FT.SEARCH missing)")
                if "unknown index" not in msg and "no such index" not in msg:
                    raise re_err

            # Create the HNSW index
            cmd = [
                "FT.CREATE", self.index_name,
                "ON", "HASH",
                "PREFIX", "1", "rag:cache:",
                "SCHEMA",
                "scope", "TAG",
                "doc_ids", "TEXT",
                "vector", "VECTOR", "HNSW", "6",
                "TYPE", "FLOAT32",
                "DIM", str(self.dim),
                "DISTANCE_METRIC", "COSINE",
                "M", "16",
                "EF_CONSTRUCTION", "200",
            ]
            client.execute_command(*cmd)
            self._initialized = True
            logger.info(f"[RedisVSS] Successfully created RediSearch HNSW index '{self.index_name}' (dim={self.dim}).")
        except redis.ResponseError as err:
            err_msg = str(err).lower()
            if "unknown command" in err_msg:
                raise RuntimeError("Redis instance does not support RediSearch VSS (FT.SEARCH missing)") from err
            logger.error(f"[RedisVSS] Failed to create index '{self.index_name}': {err}")
            raise err

    async def find_similar_passages(
        self,
        query: str,
        threshold_distance: Optional[float] = None,
    ) -> Optional[List[str]]:
        """Queries Redis VSS for passage ID pointers matching query with D <= threshold (Similarity >= 0.92).
        Returns list of parent passage IDs on Cache HIT, or None on Cache MISS.
        """
        cutoff = threshold_distance if threshold_distance is not None else self.distance_threshold
        query_vec = embedding_service.embed_text(query)

        # 1. Test Harness In-Memory Path
        if settings.ENVIRONMENT == "test":
            best_ids = None
            min_dist = float("inf")
            for doc_key, item in self._test_vectors.items():
                if item.get("scope") != "public":
                    continue
                d = cosine_distance(query_vec, item["vector"])
                if d < min_dist:
                    min_dist = d
                    best_ids = item["doc_ids"]

            if min_dist <= cutoff and best_ids:
                logger.info(f"[RedisVSS] In-Memory Cache HIT (Distance={min_dist:.4f} <= {cutoff})")
                return best_ids
            return None

        # 2. Live Redis RediSearch VSS Execution
        client = redis_service.client
        if not client:
            return None

        try:
            self._ensure_vss_index(client)
            packed_vec = pack_vector_to_bytes(query_vec)

            # RediSearch query: Top 1 candidate in public scope
            query_str = "(@scope:{public})=>[KNN 1 @vector $query_vec AS dist]"
            res = client.execute_command(
                "FT.SEARCH",
                self.index_name,
                query_str,
                "PARAMS", "2", "query_vec", packed_vec,
                "SORTBY", "dist", "ASC",
                "RETURN", "2", "dist", "doc_ids",
                "DIALECT", "2",
            )

            # RediSearch result: [total_count, key, [field, val, ...]]
            if res and len(res) > 2 and res[0] > 0:
                fields = res[2]
                fields_dict = dict(zip(fields[0::2], fields[1::2]))
                dist = float(fields_dict.get("dist", 1.0))
                doc_ids_raw = fields_dict.get("doc_ids", "[]")

                if dist <= cutoff:
                    doc_ids = json.loads(doc_ids_raw) if isinstance(doc_ids_raw, str) else doc_ids_raw
                    logger.info(f"[RedisVSS] Cache HIT! (Cosine Distance={dist:.4f} <= {cutoff}). Hydrating {len(doc_ids)} passage IDs.")
                    return doc_ids

            return None
        except Exception as err:
            logger.warning(f"[RedisVSS] Query error: {err}")
            return None

    async def store_query_passages(
        self,
        query: str,
        passage_ids: List[str],
        scope: str = "public",
        ttl: Optional[int] = None,
    ) -> bool:
        """Stores query vector -> parent passage IDs with rolling 7-day TTL."""
        if not passage_ids:
            return False

        effective_ttl = ttl or self.ttl_sec
        query_vec = embedding_service.embed_text(query)
        hash_id = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:16]
        key = f"rag:cache:{hash_id}"

        # 1. Test Harness In-Memory Path
        if settings.ENVIRONMENT == "test":
            self._test_vectors[key] = {
                "vector": query_vec,
                "doc_ids": passage_ids,
                "scope": scope,
                "expires_at": time.time() + effective_ttl,
            }
            return True

        # 2. Live Redis RediSearch VSS Execution
        client = redis_service.client
        if not client:
            return False

        try:
            self._ensure_vss_index(client)
            packed_vec = pack_vector_to_bytes(query_vec)
            client.hset(
                key,
                mapping={
                    "scope": scope,
                    "doc_ids": json.dumps(passage_ids),
                    "vector": packed_vec,
                },
            )
            client.expire(key, effective_ttl)
            logger.info(f"[RedisVSS] Cached query vector -> {len(passage_ids)} passage IDs (TTL={effective_ttl}s).")
            return True
        except Exception as err:
            logger.warning(f"[RedisVSS] Failed to store query passages in VSS: {err}")
            return False

    # Parent Docstore Operations: doc:parent:{parent_id}
    def set_parent_document(self, parent_id: str, doc: Dict[str, Any]) -> bool:
        """Stores parent document in Redis docstore."""
        key = f"doc:parent:{parent_id}"
        val = json.dumps(doc)
        if settings.ENVIRONMENT == "test":
            self._test_parent_docstore[key] = doc
            return True

        client = redis_service.client
        if client:
            try:
                client.set(key, val, ex=self.ttl_sec)
                return True
            except Exception as e:
                logger.warning(f"[RedisVSS] Error saving parent doc: {e}")
        return False

    def get_parent_document(self, parent_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves parent document from Redis docstore."""
        key = f"doc:parent:{parent_id}"
        if settings.ENVIRONMENT == "test":
            return self._test_parent_docstore.get(key)

        client = redis_service.client
        if client:
            try:
                raw = client.get(key)
                if raw:
                    return json.loads(raw)
            except Exception as e:
                logger.warning(f"[RedisVSS] Error reading parent doc: {e}")
        return None

    def unlink_user_cache(self, user_id: str, batch_size: int = 100) -> int:
        """Non-blocking event-driven invalidation via SCAN + UNLINK in batches of 100.
        Eliminates Redis single-threaded event loop freezes.
        """
        pattern = f"cache:rag:user_{user_id}:*"
        client = redis_service.client
        if not client:
            return redis_service.clear_pattern(pattern)

        deleted = 0
        cursor = 0
        try:
            while True:
                cursor, keys = client.scan(cursor=cursor, match=pattern, count=batch_size)
                if keys:
                    deleted += client.unlink(*keys)
                if cursor == 0:
                    break
            logger.info(f"[RedisVSS] Non-blocking UNLINK purged {deleted} private keys for user {user_id}")
            return deleted
        except Exception as err:
            logger.warning(f"[RedisVSS] unlink_user_cache error: {err}")
            return redis_service.clear_pattern(pattern)


# Singleton instance
redis_vss_service = RedisVSSService()
