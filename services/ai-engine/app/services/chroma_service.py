"""High-performance ChromaDB Vector Store Service.
Communicates with ChromaDB server via async HTTP REST client.
Includes fallback memory vector store for local testing without external Docker dependencies.
"""

import math
import time
import hashlib
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings
from app.core.logger import logger


def deterministic_embedding(text: str, dim: int = 64) -> List[float]:
    """Generates a normalized deterministic vector for testing without external embedding API costs."""
    vec = []
    for i in range(dim):
        h = hashlib.sha256(f"{text}_{i}".encode("utf-8")).hexdigest()
        val = (int(h[:8], 16) / 0xFFFFFFFF) * 2.0 - 1.0
        vec.append(val)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    return dot


class ChromaService:
    """Async ChromaDB integration."""

    def __init__(self):
        self.base_url = f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v1"
        self.auth_token = settings.CHROMA_AUTH_TOKEN
        # In-memory document & vector store for local testing and fail-safe fallback
        self._memory_collections: Dict[str, List[Dict[str, Any]]] = {
            settings.CHROMA_GLOBAL_COLLECTION: [
                {
                    "content": "Progressive overload is the foundation of muscle hypertrophy. Increase resistance, repetitions, or reduce rest intervals gradually.",
                    "metadata": {"source": "ACSM Guidelines", "category": "hypertrophy"},
                    "embedding": deterministic_embedding("Progressive overload hypertrophy resistance repetitions"),
                },
                {
                    "content": "A caloric deficit of 300-500 kcal per day promotes safe fat loss of 0.5-1.0% bodyweight per week while preserving lean muscle mass.",
                    "metadata": {"source": "ISSN Nutrition Position", "category": "nutrition"},
                    "embedding": deterministic_embedding("caloric deficit fat loss nutrition lean muscle"),
                },
                {
                    "content": "Adequate protein intake is 1.6 to 2.2 grams per kilogram of bodyweight for active individuals engaging in resistance training.",
                    "metadata": {"source": "Sports Dietetics", "category": "protein"},
                    "embedding": deterministic_embedding("protein intake resistance training bodyweight"),
                },
            ]
        }

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    async def ping(self) -> bool:
        """Checks if ChromaDB server is online."""
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{self.base_url}/heartbeat", headers=self._headers())
                return res.status_code == 200
        except Exception:
            return False

    async def add_documents(
        self,
        docs: List[str],
        collection_name: str,
        metadatas: Optional[List[Dict[str, Any]]] = None,
    ) -> List[str]:
        """Adds text documents and embeddings into ChromaDB collection."""
        if not docs:
            return []

        ids = [f"{collection_name}_{int(time.time()*1000)}_{i}" for i in range(len(docs))]
        metas = metadatas or [{} for _ in docs]

        # 1. Attempt ChromaDB REST call
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                # Ensure collection exists
                col_res = await client.post(
                    f"{self.base_url}/collections",
                    json={"name": collection_name, "get_or_create": True},
                    headers=self._headers(),
                )
                if col_res.status_code in (200, 201):
                    col_id = col_res.json()["id"]
                    embeddings = [deterministic_embedding(doc) for doc in docs]
                    add_res = await client.post(
                        f"{self.base_url}/collections/{col_id}/add",
                        json={
                            "ids": ids,
                            "documents": docs,
                            "embeddings": embeddings,
                            "metadatas": metas,
                        },
                        headers=self._headers(),
                    )
                    if add_res.status_code == 200:
                        logger.info(f"[ChromaService] Ingested {len(docs)} documents into collection {collection_name}")
                        return ids
        except Exception as e:
            logger.warning(f"[ChromaService] ChromaDB server unavailable ({e}). Using in-memory collection.")

        # 2. In-memory storage fallback
        if collection_name not in self._memory_collections:
            self._memory_collections[collection_name] = []

        for doc, meta, doc_id in zip(docs, metas, ids):
            self._memory_collections[collection_name].append({
                "id": doc_id,
                "content": doc,
                "metadata": meta,
                "embedding": deterministic_embedding(doc),
            })
        logger.info(f"[ChromaService] Added {len(docs)} docs to in-memory collection '{collection_name}'")
        return ids

    async def similarity_search(self, query: str, collection_name: str, k: int = 4) -> List[Dict[str, Any]]:
        """Performs vector similarity search."""
        query_vec = deterministic_embedding(query)

        # 1. Attempt ChromaDB REST query
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                get_col = await client.get(
                    f"{self.base_url}/collections/{collection_name}",
                    headers=self._headers(),
                )
                if get_col.status_code == 200:
                    col_id = get_col.json()["id"]
                    query_res = await client.post(
                        f"{self.base_url}/collections/{col_id}/query",
                        json={
                            "query_embeddings": [query_vec],
                            "n_results": k,
                        },
                        headers=self._headers(),
                    )
                    if query_res.status_code == 200:
                        data = query_res.json()
                        docs = data.get("documents", [[]])[0]
                        metas = data.get("metadatas", [[]])[0]
                        distances = data.get("distances", [[]])[0]
                        results = []
                        for d, m, dist in zip(docs, metas, distances):
                            results.append({"content": d, "metadata": m or {}, "score": dist})
                        return results
        except Exception as e:
            logger.debug(f"[ChromaService] REST search failed ({e}). Searching in-memory collection.")

        # 2. In-memory cosine search fallback
        items = self._memory_collections.get(collection_name, [])
        scored = []
        for item in items:
            score = cosine_similarity(query_vec, item["embedding"])
            scored.append({"content": item["content"], "metadata": item.get("metadata", {}), "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:k]

    async def search_for_user(self, query: str, user_id: Optional[str] = None, k: int = 4) -> List[Dict[str, Any]]:
        """Multi-tenant search: queries global knowledge + user's collection (Section 11.2)."""
        global_results = await self.similarity_search(query, settings.CHROMA_GLOBAL_COLLECTION, k=k)
        if not user_id:
            return global_results

        user_col = f"fitness_user_{user_id}"
        user_results = await self.similarity_search(query, user_col, k=k)
        combined = global_results + user_results
        combined.sort(key=lambda x: x.get("score", 0), reverse=True)
        return combined[:k]


# Singleton instance
chroma_service = ChromaService()
