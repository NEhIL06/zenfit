"""Comprehensive Unit & Integration Tests for Next-Gen Agentic Self-RAG Pipeline.
Verifies all 6 Upgradation Pillars:
1. Redis VSS Semantic Retrieval Caching & Passage-ID pointer bypass.
2. Phase 1 Upfront Query Translation Router (direct, rag_fusion, decomposition, step_back).
3. Hybrid Retrieval & Parent-Child chunk hydration deduplication.
4. FlashRank Multilingual Cross-Encoder Reranking & Confidence Gating (tau >= 0.65).
5. Phase 2 Adaptive Re-Retrieval Ladder & Plateau Detection Circuit Breaker.
6. Context-Aware Web Search Fallback & Agentic Tool Calling (generate_exercise_visual).
"""

import asyncio
import pytest
from app.services.embedding_service import embedding_service
from app.services.redis_vss_service import redis_vss_service
from app.services.rerank_service import rerank_service
from app.services.query_translation_service import query_translation_service
from app.services.parent_child_service import parent_child_resolver
from app.services.adaptive_ladder import adaptive_ladder, AdaptiveRetrievalLadder
from app.services.web_search_service import web_search_service
from app.services.rag_service import rag_pipeline


# 1. Embedding & Redis VSS Semantic Cache Tests
def test_embedding_dimensions_and_normalization():
    vec = embedding_service.embed_text("barbell squat biomechanics")
    assert len(vec) == 768
    norm = sum(x * x for x in vec) ** 0.5
    assert abs(norm - 1.0) < 1e-4


def test_redis_vss_semantic_cache_hit_and_miss():
    async def _test():
        query = "How to perform barbell squat with good form"
        doc_ids = ["parent_squat_kinetics"]

        # Before caching: should be MISS
        miss_res = await redis_vss_service.find_similar_passages(query, threshold_distance=0.08)
        assert miss_res is None

        # Cache query vector -> doc IDs
        stored = await redis_vss_service.store_query_passages(query, doc_ids, ttl=600)
        assert stored is True

        # Exact query: should be Cache HIT
        hit_res = await redis_vss_service.find_similar_passages(query, threshold_distance=0.08)
        assert hit_res is not None
        assert hit_res == doc_ids

        # Unrelated query: should be Cache MISS
        unrelated_res = await redis_vss_service.find_similar_passages("what is the best macro ratio for marathon running", threshold_distance=0.08)
        assert unrelated_res is None

    asyncio.run(_test())


# 2. Phase 1 Upfront Query Translation Router Tests
def test_query_translation_routes():
    # A. Kinetic pain symptom -> step_back
    plan_pain = query_translation_service.translate_query("why do my knees pinch at bottom of squat")
    assert plan_pain.route == "step_back"
    assert len(plan_pain.search_queries) == 2
    assert any("patellofemoral" in q for q in plan_pain.search_queries)

    # B. Compound multi-intent -> decomposition
    plan_comp = query_translation_service.translate_query("give me a 4-day PPL split and what to eat to cut 5kg")
    assert plan_comp.route == "decomposition"
    assert len(plan_comp.search_queries) == 2

    # C. Vernacular / Slang -> rag_fusion
    plan_slang = query_translation_service.translate_query("how to fix winged scapula")
    assert plan_slang.route == "rag_fusion"
    assert len(plan_slang.search_queries) == 3

    # D. Clean direct -> direct
    plan_direct = query_translation_service.translate_query("what is the recommended daily protein intake")
    assert plan_direct.route == "direct"
    assert len(plan_direct.search_queries) == 1


# 3. Parent-Child Chunk Hydration & Deduplication Tests
def test_parent_child_resolution_and_deduplication():
    child_chunks = [
        {"id": "c1", "parent_id": "parent_squat_kinetics", "content": "child needle 1"},
        {"id": "c2", "parent_id": "parent_squat_kinetics", "content": "child needle 2"},
        {"id": "c3", "parent_id": "parent_hypertrophy_principles", "content": "child needle 3"},
    ]
    resolved = parent_child_resolver.resolve_and_deduplicate(child_chunks)
    assert len(resolved) == 2
    parent_ids = {r["id"] for r in resolved}
    assert "parent_squat_kinetics" in parent_ids
    assert "parent_hypertrophy_principles" in parent_ids
    squat_doc = next(r for r in resolved if r["id"] == "parent_squat_kinetics")
    assert "barbell back squat" in squat_doc["content"].lower()


# 4. FlashRank Cross-Encoder & Confidence Gating Tests
def test_flashrank_reranker_and_confidence_filter():
    query = "serratus anterior activation exercises"
    passages = [
        {"id": "1", "content": "Serratus anterior activation punches and wall slides"},
        {"id": "2", "content": "Caloric deficit promotes fat loss in sedentary adults"},
    ]
    scored = rerank_service.rerank_all(query, passages)
    assert len(scored) == 2
    assert scored[0]["id"] == "1"
    assert scored[0]["score"] > scored[1]["score"]

    confident = rerank_service.rerank(query, passages)
    assert len(confident) >= 1
    assert confident[0]["id"] == "1"


# 5. Adaptive Re-Retrieval Ladder & Plateau Detection Tests
def test_adaptive_ladder_baseline_success():
    async def _test():
        candidates = [
            {"id": "p1", "content": "Barbell back squat kinetic chain and quad activation", "score": 0.85}
        ]
        docs, route = await adaptive_ladder.execute_ladder(
            original_query="barbell back squat",
            initial_candidates=candidates,
        )
        assert "round_0" in route
        assert len(docs) > 0

    asyncio.run(_test())


def test_adaptive_ladder_plateau_detection_to_web():
    async def _test():
        class PlateauMockChroma:
            async def hybrid_search(self, *args, **kwargs):
                return [{"id": "plateau_doc", "content": "no new information", "score": 0.45}]

        plateau_ladder = AdaptiveRetrievalLadder(
            chroma=PlateauMockChroma(),
            reranker=rerank_service,
            redis_vss=redis_vss_service,
            web=web_search_service,
        )
        candidates = [
            {"id": "weak_1", "content": "no new information", "score": 0.45}
        ]
        docs, route = await plateau_ladder.execute_ladder(
            original_query="obscure neurological deficit test",
            initial_candidates=candidates,
        )
        assert route == "web_search_fallback"
        assert len(docs) > 0
        assert any("Clinical Web Search" in d.get("metadata", {}).get("source", "") for d in docs)

    asyncio.run(_test())


# 6. Context-Aware Web Search Fallback Engine Tests
def test_web_search_fallback_synthesis():
    async def _test():
        query = "patellofemoral crepitus rehabilitation"
        docs = await web_search_service.synthesize_and_search(query)
        assert len(docs) > 0
        top = docs[0]
        assert "content" in top
        assert "source" in top["metadata"]

    asyncio.run(_test())


# 7. Agentic Tool-Calling Detection Tests
def test_detect_visual_tool_call():
    tool_call = rag_pipeline.detect_visual_tool_call("Can you demonstrate proper form for the Barbell Back Squat?")
    assert tool_call is not None
    assert tool_call.tool == "generate_exercise_visual"
    assert tool_call.args["category"] == "exercise"
    assert "Squat" in tool_call.args["item_name"]

    meal_call = rag_pipeline.detect_visual_tool_call("What does a balanced high-protein salmon meal look like?")
    assert meal_call is not None
    assert meal_call.tool == "generate_exercise_visual"
    assert meal_call.args["category"] == "meal"

    no_tool = rag_pipeline.detect_visual_tool_call("Good morning coach!")
    assert no_tool is None


# 8. End-to-End Chat API Pipeline Integration Tests
def test_chat_api_with_tool_call_and_vss(client):
    payload = {
        "message": "Please show me proper form and technique for the barbell squat",
        "userId": "usr_vss_test",
        "userPlanContext": "Goal: Hypertrophy, Active injury: Mild right knee crepitus",
    }
    response = client.post("/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "response" in data
    assert data["classification"] == "fitness"
    assert len(data["sources"]) > 0
    assert data["tool_calls"] is not None
    assert len(data["tool_calls"]) > 0
    assert data["tool_calls"][0]["tool"] == "generate_exercise_visual"
    assert "retrieval_route" in data


def test_chat_sse_stream_tool_call_event(client):
    payload = {
        "message": "Demonstrate the setup and technique for barbell squat",
        "userId": "usr_sse_test",
    }
    response = client.post("/v1/chat", json=payload, headers={"Accept": "text/event-stream"})
    assert response.status_code == 200
    text = response.text
    assert "event: tool_call" in text
    assert "generate_exercise_visual" in text
    assert "data:" in text
    assert '"done": true' in text
