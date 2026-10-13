"""Adaptive Self-Reflective Re-Retrieval Ladder (Phase 2 Post-Retrieval).
Implements Section 3.1 & Section 4.6 of ZenFit Architecture Specification:
1. Round 0 (Baseline): Initial hybrid search evaluated by FlashRank (tau >= 0.65).
2. Round 1 (Vocabulary / MeSH Taxonomy Shift): Colloquial -> NSCA/MeSH clinical terms.
   - Redis VSS Canonical Cache check (returns in <5ms if pre-cached).
   - Rerun ChromaDB Parallel Hybrid Search + FlashRank check.
3. Plateau Detection Circuit Breaker: If delta score < +0.05, terminates internal retrieval
   immediately to prevent semantic drift, routing straight to Web Search Fallback.
4. Round 2 (Structural Step-Back Concept Relaxation): Relaxes machine/rep constraints.
5. Strict 220ms Hard SLA Retrieval Timeout.
6. Context-Aware Web Search Fallback Engine failover.
"""

import time
import re
from typing import List, Dict, Any, Tuple, Optional
from app.config import settings
from app.core.logger import logger
from app.services.chroma_service import chroma_service
from app.services.rerank_service import rerank_service
from app.services.redis_vss_service import redis_vss_service
from app.services.parent_child_service import parent_child_resolver
from app.services.web_search_service import web_search_service

MESH_TRANSLATION_MAP = {
    "winged scapula": "scapular winging serratus anterior activation horizontal press",
    "winged shoulder blades": "scapular dyskinesis serratus anterior protraction rehabilitation",
    "chicken legs": "quadriceps hypertrophy progressive overload squat knee flexion",
    "knee pinch": "patellofemoral joint contact stress ankle dorsiflexion mobility",
    "knee pain": "patellar tendonitis vastus medialis oblique eccentric loading",
    "shoulder click": "glenohumeral impingement rotator cuff subacromial space",
    "cannonball delts": "lateral deltoid mechanical tension abduction biomechanics",
    "boulder shoulders": "scapular plane lateral raise anterior posterior balance",
    "cut": "caloric deficit macronutrient distribution lean mass preservation",
    "bulk": "caloric surplus muscle protein synthesis volume periodization",
}


class AdaptiveRetrievalLadder:
    """Adaptive 3-Round Strategy Ladder with Plateau Breaker and Hard SLA Budget."""

    def __init__(
        self,
        chroma=None,
        reranker=None,
        redis_vss=None,
        web=None,
        confidence_threshold: Optional[float] = None,
        plateau_delta: float = 0.05,
        sla_timeout_seconds: Optional[float] = None,
    ):
        self.chroma = chroma or chroma_service
        self.reranker = reranker or rerank_service
        self.redis_vss = redis_vss or redis_vss_service
        self.web = web or web_search_service
        self.confidence_threshold = (
            confidence_threshold
            if confidence_threshold is not None
            else settings.FLASHRANK_CONFIDENCE_THRESHOLD
        )
        self.plateau_delta = plateau_delta
        self.sla_timeout_seconds = (
            sla_timeout_seconds
            if sla_timeout_seconds is not None
            else settings.RETRIEVAL_SLA_TIMEOUT_SEC
        )

    async def _rewrite_mesh_taxonomy(self, query: str) -> str:
        """Translates colloquial entities to NSCA/MeSH clinical physiology terminology."""
        lower = query.lower()
        for term, mesh_phrase in MESH_TRANSLATION_MAP.items():
            if term in lower:
                return f"{mesh_phrase} clinical exercise physiology"

        # General MeSH entity enrichment
        clean = re.sub(r"^(hey|how|what|why|is)\b", "", query, flags=re.IGNORECASE).strip()
        return f"{clean} clinical exercise science biomechanics and physiological adaptation"

    async def _rewrite_step_back_concept(self, query: str) -> str:
        """Relaxes machine and rep constraints to retrieve foundational kinetic principles."""
        clean = re.sub(r"\b(\d+\s*reps|\d+\s*sets|machine|barbell|dumbbell)\b", "", query, flags=re.IGNORECASE)
        return f"foundational kinetic chain stability and neuromuscular motor control {clean.strip()}"

    async def execute_ladder(
        self,
        original_query: str,
        initial_candidates: List[Dict[str, Any]],
        user_context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """Executes the bounded 3-round adaptive strategy ladder."""
        start_time = time.perf_counter()
        context = user_context or {}

        # Round 0: Score Initial Baseline Pass
        r0_results = self.reranker.rerank_all(original_query, initial_candidates)
        top_score_r0 = r0_results[0].get("score", 0.0) if r0_results else 0.0
        logger.info(f"[AdaptiveLadder] Round 0 evaluated {len(r0_results)} candidates. Top score: {top_score_r0:.4f} (Threshold: {self.confidence_threshold})")

        if top_score_r0 >= self.confidence_threshold:
            # Confident! Store in Redis VSS and return
            doc_ids = [d.get("id") for d in r0_results[:4] if d.get("id")]
            await self.redis_vss.store_query_passages(original_query, doc_ids)
            return r0_results, "round_0_direct"

        # Check Timeout SLA Budget (220ms)
        elapsed = time.perf_counter() - start_time
        if elapsed > self.sla_timeout_seconds:
            logger.warning(f"[AdaptiveLadder] SLA timeout breached ({elapsed*1000:.1f}ms > {self.sla_timeout_seconds*1000}ms). Failover to web.")
            return await self._fallback_to_web(original_query, context)

        # Step 1: Round 1 (Vocabulary / MeSH Taxonomy Shift)
        r1_query = await self._rewrite_mesh_taxonomy(original_query)
        logger.info(f"[AdaptiveLadder] Round 1 MeSH query rewrite: '{r1_query}'")

        # Check if canonical query hits Redis VSS
        vss_hit_ids = await self.redis_vss.find_similar_passages(r1_query, threshold_distance=0.08)
        if vss_hit_ids:
            logger.info(f"[AdaptiveLadder] Canonical MeSH query hit Redis VSS! Hydrating {len(vss_hit_ids)} passages.")
            hydrated = [parent_child_resolver.hydrate_parent({"id": pid}) for pid in vss_hit_ids]
            return hydrated, "round_1_vss_cache"

        r1_candidates = await self.chroma.hybrid_search(r1_query, user_id=user_id, top_k=15)
        r1_results = self.reranker.rerank_all(r1_query, r1_candidates)
        top_score_r1 = r1_results[0].get("score", 0.0) if r1_results else 0.0
        logger.info(f"[AdaptiveLadder] Round 1 top score: {top_score_r1:.4f} (Delta from R0: {top_score_r1 - top_score_r0:+.4f})")

        if top_score_r1 >= self.confidence_threshold:
            doc_ids = [d.get("id") for d in r1_results[:4] if d.get("id")]
            await self.redis_vss.store_query_passages(original_query, doc_ids)
            return r1_results, "round_1_mesh"

        # Plateau Breaker Check
        delta = top_score_r1 - top_score_r0
        if delta < self.plateau_delta:
            logger.info(
                f"[AdaptiveLadder] Plateau detected! Delta score {delta:.4f} < {self.plateau_delta}. Internal knowledge deficit identified. Failover to Web Search."
            )
            return await self._fallback_to_web(original_query, context)

        # Check Timeout SLA Budget
        elapsed = time.perf_counter() - start_time
        if elapsed > self.sla_timeout_seconds:
            logger.warning(f"[AdaptiveLadder] SLA timeout breached ({elapsed*1000:.1f}ms). Failover to web.")
            return await self._fallback_to_web(original_query, context)

        # Step 2: Round 2 (Structural Step-Back Concept Relaxation)
        r2_query = await self._rewrite_step_back_concept(original_query)
        logger.info(f"[AdaptiveLadder] Round 2 Step-Back concept rewrite: '{r2_query}'")
        r2_candidates = await self.chroma.hybrid_search(r2_query, user_id=user_id, top_k=15)
        r2_results = self.reranker.rerank_all(r2_query, r2_candidates)
        top_score_r2 = r2_results[0].get("score", 0.0) if r2_results else 0.0
        logger.info(f"[AdaptiveLadder] Round 2 top score: {top_score_r2:.4f}")

        if top_score_r2 >= self.confidence_threshold:
            doc_ids = [d.get("id") for d in r2_results[:4] if d.get("id")]
            await self.redis_vss.store_query_passages(original_query, doc_ids)
            return r2_results, "round_2_step_back"

        # Exhausted all internal attempts -> Failover to Web Search
        logger.info("[AdaptiveLadder] Exhausted internal retrieval rounds. Engaging Context-Aware Web Search Fallback.")
        return await self._fallback_to_web(original_query, context)

    async def _fallback_to_web(self, query: str, user_context: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], str]:
        """Dispatches context-aware web search fallback."""
        web_docs = await self.web.synthesize_and_search(query, user_context=user_context)
        return web_docs, "web_search_fallback"


# Singleton instance
adaptive_ladder = AdaptiveRetrievalLadder()
