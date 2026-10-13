"""FlashRank Multilingual Cross-Encoder Reranking Service.
Implements Section 3.1 & Section 4.2 of ZenFit Architecture Specification:
1. Ultra-lite CPU-native ONNX runtime (~80MB footprint, no PyTorch).
2. ms-marco-MultiBERT-L-12 model supporting 100+ languages.
3. max_length=128 matched exactly to 64-128 token child chunks for sub-25ms inference.
4. Calibrated confidence threshold (tau >= 0.65) statistical circuit breaker.
"""

from typing import List, Dict, Any, Optional
from app.config import settings
from app.core.logger import logger

try:
    from flashrank import Ranker, RerankRequest
except ImportError:
    Ranker = None
    RerankRequest = None


class RerankService:
    """FlashRank CPU-based cross-encoder reranker."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        max_length: Optional[int] = None,
        threshold: Optional[float] = None,
        cache_dir: Optional[str] = None,
    ):
        self.model_name = model_name or settings.FLASHRANK_MODEL
        self.max_length = max_length or settings.FLASHRANK_MAX_LENGTH
        self.threshold = threshold if threshold is not None else settings.FLASHRANK_CONFIDENCE_THRESHOLD
        self.cache_dir = cache_dir or settings.FLASHRANK_CACHE_DIR
        self._ranker: Optional[Any] = None

    @property
    def ranker(self) -> Optional[Any]:
        if self._ranker is None and Ranker is not None and settings.ENVIRONMENT != "test":
            try:
                self._ranker = Ranker(
                    model_name=self.model_name,
                    max_length=self.max_length,
                    cache_dir=self.cache_dir,
                )
                logger.info(f"[RerankService] Initialized FlashRank model '{self.model_name}' (max_length={self.max_length})")
            except Exception as e:
                logger.warning(f"[RerankService] FlashRank model initialization failed ({e}). Falling back to algorithmic reranker.")
                self._ranker = None
        return self._ranker

    def _fallback_score(self, query: str, passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Algorithmic BM25/keyword scoring fallback for test environments or offline mode."""
        query_terms = set(query.lower().split())
        scored = []
        for p in passages:
            text = (p.get("text") or p.get("content") or "").lower()
            text_terms = set(text.split())
            overlap = len(query_terms.intersection(text_terms))
            # Calculate calibrated ratio
            base_score = p.get("score", 0.5)
            calc_score = 0.5 + (0.45 * (overlap / max(1, len(query_terms))))
            final_score = min(0.95, max(base_score, calc_score))

            doc = dict(p)
            doc["score"] = round(final_score, 4)
            scored.append(doc)

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored

    def rerank_all(self, query: str, passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Scores all candidate passages using FlashRank, returning all sorted with their scores.
        Used by the Adaptive Re-Retrieval Ladder to measure score deltas and plateaus.
        """
        if not passages:
            return []

        # Standardize format for FlashRank
        formatted = []
        for idx, p in enumerate(passages):
            item = {
                "id": p.get("id", f"p_{idx}"),
                "text": p.get("text") or p.get("content", ""),
                "meta": p.get("metadata") or p.get("meta", {}),
            }
            # Carry over original properties
            for k, v in p.items():
                if k not in ("id", "text", "meta"):
                    item[k] = v
            formatted.append(item)

        if self.ranker and RerankRequest:
            try:
                req = RerankRequest(query=query, passages=formatted)
                ranked = self.ranker.rerank(req)
                return ranked
            except Exception as err:
                logger.warning(f"[RerankService] FlashRank inference error ({err}). Using fallback.")

        return self._fallback_score(query, formatted)

    def rerank(self, query: str, passages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Evaluates candidate passages and filters by confidence gate (score >= threshold)."""
        scored = self.rerank_all(query, passages)
        return [r for r in scored if r.get("score", 0.0) >= self.threshold]


# Singleton instance
rerank_service = RerankService()
