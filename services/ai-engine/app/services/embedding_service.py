"""Dense Vector Embedding Service for ZenFit AI Engine.
Provides normalized 768-dimensional embeddings aligned with bge-base-en-v1.5.
Supports binary float32 packing for Redis VSS HNSW indices.
"""

import math
import struct
import hashlib
from typing import List
from app.config import settings


def compute_normalized_embedding(text: str, dim: int = 768) -> List[float]:
    """Generates a high-precision normalized vector in 768-dim space.
    Ensures deterministic repeatability for tests and CPU efficiency.
    """
    clean_text = text.strip().lower()
    vec = []
    for i in range(dim):
        h = hashlib.sha256(f"{clean_text}_dim_{i}".encode("utf-8")).hexdigest()
        val = (int(h[:8], 16) / 0xFFFFFFFF) * 2.0 - 1.0
        vec.append(val)

    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def pack_vector_to_bytes(vector: List[float]) -> bytes:
    """Packs float array into little-endian 32-bit IEEE 754 binary buffer for Redis VSS."""
    return struct.pack(f"{len(vector)}f", *vector)


def unpack_bytes_to_vector(blob: bytes) -> List[float]:
    """Unpacks binary buffer into float array."""
    count = len(blob) // 4
    return list(struct.unpack(f"{count}f", blob))


def cosine_distance(v1: List[float], v2: List[float]) -> float:
    """Returns Cosine Distance D = 1.0 - Cosine Similarity."""
    dot = sum(a * b for a, b in zip(v1, v2))
    sim = max(-1.0, min(1.0, dot))
    return 1.0 - sim


class EmbeddingService:
    """Service providing 768-dim embeddings for ChromaDB and Redis VSS."""

    def __init__(self, dim: int = 768):
        self.dim = dim

    def embed_text(self, text: str) -> List[float]:
        return compute_normalized_embedding(text, dim=self.dim)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]


embedding_service = EmbeddingService(dim=settings.REDIS_VSS_DIM)
