"""Upfront Query Translation Router (Phase 1 Pre-Retrieval).
Implements Section 3.1 & Section 4.5 of ZenFit Architecture Specification:
1. Structured QueryTranslationPlan executed in <35ms.
2. 4 Execution Routes:
   - direct: Strips conversational filler, extracts clean fitness entities.
   - rag_fusion: Slang/vernacular translation into 3 orthogonal scientific queries.
   - decomposition: Splits compound multi-intent into Sub-Query A (Diet) + Sub-Query B (Training).
   - step_back: Splits kinetic pain/symptom into Specific Symptom + Foundational Principle.
3. Parallel execution via asyncio.gather and Reciprocal Rank Fusion (RRF, k=60).
"""

import re
import asyncio
from typing import List, Literal, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.core.logger import logger


class QueryTranslationPlan(BaseModel):
    route: Literal["direct", "rag_fusion", "decomposition", "step_back"] = Field(
        description="Selected routing mode based on ambiguity, vernacular, or multi-intent analysis"
    )
    reasoning: str = Field(description="Brief rationale for translation routing")
    search_queries: List[str] = Field(
        min_length=1,
        max_length=3,
        description="Target search queries optimized for dense embedding and BM25 token matching"
    )
    extracted_entities: List[str] = Field(
        description="Key biomechanical, anatomical, and nutritional entities extracted"
    )


# Entity and Vernacular Matchers
SLANG_VERNACULAR_MAP = {
    "cannonball delts": ["lateral deltoid hypertrophy", "overhead press mechanics", "abduction biomechanics"],
    "boulder shoulders": ["scapular plane lateral raise", "deltoid mechanical tension", "anterior posterior deltoid balance"],
    "chicken legs": ["quadriceps hypertrophy squat", "hamstring knee flexion", "calf gastrocnemius overload"],
    "winged shoulder blades": ["scapular winging serratus anterior", "long thoracic nerve rehabilitation", "scapulohumeral rhythm"],
    "winged scapula": ["serratus anterior protraction", "scapular dyskinesis", "lower trapezius activation"],
    "shredded": ["caloric deficit fat oxidation", "lean mass retention", "protein pacing thermogenesis"],
    "cut": ["caloric deficit rate of loss", "macronutrient distribution cut", "resistance training preservation"],
    "bulk": ["caloric surplus hypertrophy", "hypertrophic protein synthesis", "progressive volume loading"],
    "pecs": ["pectoralis major clavicular sternal head", "horizontal adduction biomechanics", "bench press arch bar path"],
}

KINETIC_PAIN_KEYWORDS = {
    "pinch", "pain", "hurt", "clicking", "click", "crepitus", "pop", "impingement",
    "strain", "tweak", "sore knee", "sore shoulder", "lower back ache", "tendonitis"
}

COMPOUND_DELIMITERS = [
    " and what to eat", " and also diet", " plus what to eat", " and nutrition",
    " with diet plan", " and meal plan", " plus diet", " split and diet"
]

CONVERSATIONAL_FILLERS = [
    r"^(hey|hello|hi|please|coach|can you tell me|what is|how do i|how to|i want to know)\b",
    r"\b(can you help me with|could you explain|give me advice on)\b",
]


class QueryTranslationService:
    """Upfront Query Translation Router producing structured QueryTranslationPlan in <35ms."""

    def translate_query(self, query: str) -> QueryTranslationPlan:
        """Analyzes query semantics and generates structured translation plan."""
        lower = query.strip().lower()

        # 1. Kinetic Symptom / Pain Pattern -> step_back
        for kw in KINETIC_PAIN_KEYWORDS:
            if kw in lower:
                clean = self._clean_filler(query)
                # Formulate specific symptom + foundational biomechanical principle
                symptom_query = clean
                if "knee" in lower or "squat" in lower:
                    principle_query = "patellofemoral joint contact mechanics ankle dorsiflexion mobility"
                    entities = ["patellofemoral joint", "ankle dorsiflexion", "knee flexion"]
                elif "shoulder" in lower or "bench" in lower or "press" in lower:
                    principle_query = "glenohumeral joint impingement scapulohumeral rhythm rotator cuff"
                    entities = ["glenohumeral joint", "rotator cuff", "scapular upward rotation"]
                elif "back" in lower or "deadlift" in lower:
                    principle_query = "lumbar spine shear forces intra abdominal pressure hip hinge"
                    entities = ["lumbar spine", "intra-abdominal pressure", "hip hinge"]
                else:
                    principle_query = f"kinetic chain stabilization biomechanical principles {kw}"
                    entities = [kw, "kinetic stabilization"]

                return QueryTranslationPlan(
                    route="step_back",
                    reasoning=f"Detected kinetic discomfort symptom '{kw}'. Generated specific symptom query and foundational biomechanical principle query.",
                    search_queries=[symptom_query, principle_query],
                    extracted_entities=entities,
                )

        # 2. Compound Multi-Intent Pattern -> decomposition
        for delim in COMPOUND_DELIMITERS:
            if delim in lower:
                parts = lower.split(delim, 1)
                sub_q1 = self._clean_filler(parts[0]) + " training routine"
                sub_q2 = "clinical nutrition and diet plan " + self._clean_filler(parts[1])
                return QueryTranslationPlan(
                    route="decomposition",
                    reasoning="Detected compound orthogonal query combining training and nutrition intents. Decomposed into independent sub-queries.",
                    search_queries=[sub_q1, sub_q2],
                    extracted_entities=["training periodization", "macronutrient diet protocol"],
                )

        # 3. Colloquial / Gym Vernacular Pattern -> rag_fusion
        for slang, scientific_queries in SLANG_VERNACULAR_MAP.items():
            if slang in lower:
                return QueryTranslationPlan(
                    route="rag_fusion",
                    reasoning=f"Detected colloquial vernacular '{slang}'. Expanded into 3 orthogonal scientific search expressions.",
                    search_queries=scientific_queries[:3],
                    extracted_entities=[slang] + [q.split()[0] for q in scientific_queries],
                )

        # 4. Standard Fitness Query -> direct
        clean = self._clean_filler(query)
        entities = [w for w in clean.split() if len(w) > 3][:4]
        return QueryTranslationPlan(
            route="direct",
            reasoning="Direct clean fitness query with standard exercise physiology entities.",
            search_queries=[clean],
            extracted_entities=entities or ["exercise science"],
        )

    def _clean_filler(self, text: str) -> str:
        """Strips conversational noise and filler words."""
        cleaned = text.strip()
        for pat in CONVERSATIONAL_FILLERS:
            cleaned = re.sub(pat, "", cleaned, flags=re.IGNORECASE).strip()
        # Remove trailing punctuation
        cleaned = re.sub(r"[?!.,]+$", "", cleaned).strip()
        return cleaned or text.strip()


async def execute_upfront_hybrid_search(
    plan: QueryTranslationPlan,
    chroma_service,
    k: int = 15,
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Executes all translated queries across ChromaDB hybrid indices in parallel

    using asyncio.gather and fuses results via Reciprocal Rank Fusion (RRF, k=60).
    """
    search_coros = [
        chroma_service.hybrid_search(query=q, user_id=user_id, top_k=k)
        for q in plan.search_queries
    ]
    multi_results = await asyncio.gather(*search_coros)

    # Reciprocal Rank Fusion (RRF, k=60)
    rrf_scores: Dict[str, float] = {}
    doc_map: Dict[str, Dict[str, Any]] = {}

    for query_result in multi_results:
        for rank, doc in enumerate(query_result):
            doc_id = doc.get("id") or str(hash(doc.get("content", "")))
            doc_map[doc_id] = doc
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (60.0 + (rank + 1)))

    sorted_doc_ids = sorted(rrf_scores.keys(), key=lambda did: rrf_scores[did], reverse=True)
    fused_docs = []
    for did in sorted_doc_ids[:k]:
        item = dict(doc_map[did])
        item["rrf_score"] = rrf_scores[did]
        fused_docs.append(item)

    logger.info(f"[QueryTranslation] Executed route '{plan.route}' with {len(plan.search_queries)} queries -> Fused {len(fused_docs)} candidate chunks.")
    return fused_docs


# Singleton instance
query_translation_service = QueryTranslationService()
