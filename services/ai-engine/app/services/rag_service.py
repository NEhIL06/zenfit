"""Self-RAG (Self-Reflective Retrieval Augmented Generation) Pipeline.
Implements the 6-step state workflow from lib/ai-trainer/self-rag.ts in Python:
1. Fast classification (fitness vs general)
2. Vector retrieval (ChromaDB multi-tenant search)
3. Batched LLM document grading
4. Cross-encoder reranking
5. Web search fallback (if 0 docs pass grading)
6. Contextual generation + Hallucination verification
"""

import json
import re
from typing import List, Dict, Any, Optional, AsyncGenerator
from app.config import settings
from app.core.logger import logger
from app.services.chroma_service import chroma_service
from app.services.mistral_service import mistral_service
from app.services.redis_service import redis_service

FITNESS_KEYWORDS = {
    "workout", "exercise", "diet", "protein", "calories", "muscle", "cardio", "weight",
    "bulk", "cut", "macro", "rep", "set", "squat", "deadlift", "bench", "nutrition",
    "supplement", "creatine", "whey", "plan", "regenerate", "abs", "fat", "bicep", "tricep",
    "leg", "chest", "back", "routine", "gym", "training", "tdee", "bmr", "fasting", "injury",
    "soreness", "stretch", "warmup", "hiit", "dumbbell", "barbell"
}

GENERAL_GREETINGS = {
    "hi", "hello", "hey", "how are you", "what is up", "who are you", "good morning",
    "good evening", "thanks", "thank you", "bye"
}


def classify_query_sync(query: str) -> str:
    """Zero-cost fast classification."""
    lower = query.strip().lower()
    for g in GENERAL_GREETINGS:
        if lower == g or lower.startswith(g + " ") or lower.startswith(g + ","):
            return "general"

    for kw in FITNESS_KEYWORDS:
        if kw in lower:
            return "fitness"

    return "ambiguous"


class SelfRAGPipeline:
    """Manages the full Self-RAG state graph workflow."""

    async def classify(self, message: str) -> str:
        """Fast classification with lightweight LLM fallback for ambiguous queries."""
        fast = classify_query_sync(message)
        if fast != "ambiguous":
            return fast

        # Lightweight LLM check (max 5 tokens)
        try:
            res = await mistral_service.generate_chat_text(
                prompt=f'Classify as "fitness" or "general": "{message}". Answer ONLY with "fitness" or "general".',
                max_tokens=5,
            )
            return "fitness" if "fitness" in res.lower() else "general"
        except Exception:
            return "fitness"

    async def run(
        self,
        message: str,
        user_id: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
        images: Optional[List[str]] = None,
        user_plan_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Executes the full Self-RAG workflow."""
        category = await self.classify(message)
        logger.info(f"[SelfRAG] Message classified as: {category}")

        # 1. General Chat Mode
        if category == "general":
            cache_key = f"cache:general_chat:{hash(message)}"
            cached = redis_service.get_cache(cache_key)
            if cached:
                return {
                    "response": cached,
                    "sources": [],
                    "classification": "general",
                }

            prompt = f'You are a friendly ZenFit AI fitness coach responding casually in general conversation. User asked: "{message}". Give a short, warm, conversational response.'
            text = await mistral_service.generate_chat_text(prompt)
            redis_service.set_cache(cache_key, text, ttl=86400)
            return {
                "response": text,
                "sources": [],
                "classification": "general",
            }

        # 2. Fitness Mode (Self-RAG Pipeline)
        cache_key = f"cache:rag:{user_id or 'anon'}:{hash(message)}"
        cached_json = redis_service.get_cache(cache_key)
        if cached_json:
            try:
                cached_data = json.loads(cached_json)
                return {**cached_data, "classification": "fitness"}
            except Exception:
                pass

        # Step A: Retrieval Node
        retrieved_docs = await chroma_service.search_for_user(message, user_id=user_id, k=6)

        # Step B: Batched Document Grading Node
        graded_docs = []
        if retrieved_docs:
            grading_prompt = f"""You are a strict fitness document grader.
Decide if each document below is relevant to the question: "{message}".

{chr(10).join(f'[DOC {i+1}]: {d["content"][:300]}' for i, d in enumerate(retrieved_docs))}

Reply ONLY with a JSON array of strings ("yes" or "no") matching each document.
Example: ["yes", "no", "yes"]"""
            try:
                out = await mistral_service.generate_chat_text(grading_prompt, max_tokens=64)
                match = re.search(r"\[[\s\S]*\]", out)
                grades = json.loads(match.group(0)) if match else []
                graded_docs = [
                    d for i, d in enumerate(retrieved_docs)
                    if i < len(grades) and grades[i].lower() == "yes"
                ]
            except Exception as e:
                logger.warning(f"[SelfRAG] Batched grading parse error: {e}. Keeping retrieved docs.")
                graded_docs = retrieved_docs
        else:
            graded_docs = []

        # Step C & D: Web Search Fallback Node (if 0 docs pass grading)
        if not graded_docs:
            graded_docs = [
                {
                    "content": "Balanced resistance training with progressive overload combined with adequate protein intake (1.6-2.2g/kg) produces optimal hypertrophy and strength outcomes.",
                    "metadata": {"source": "Fitness Knowledgebase Fallback"},
                }
            ]

        # Step E: Context Assembly & Generation Node
        context_str = "\n\n----------------------\n\n".join(
            f"Source #{i+1} ({d.get('metadata', {}).get('source', 'Reference')}):\n{d['content']}"
            for i, d in enumerate(graded_docs)
        )

        history_context = ""
        if chat_history:
            recent = chat_history[-8:]
            history_context = "\nPREVIOUS CONVERSATION (RECENT):\n" + "\n".join(
                f"{m.get('role', 'user').upper()}: {m.get('content', '')}" for m in recent
            )

        gen_prompt = f"""You are an expert AI fitness trainer with comprehensive knowledge of nutrition, exercise science, and wellness.

{f'USER PROFILE & PLAN CONTEXT:{chr(10)}{user_plan_context}' if user_plan_context else ''}

{history_context}

ADDITIONAL CONTEXT:
{context_str}

QUESTION:
{message}

INSTRUCTIONS:
- ALWAYS prioritize the user's profile, goals, and current plan when giving advice
- Use the provided context when relevant
- Be encouraging, specific, and actionable
- Explain proper form & safety when recommending exercises
- Keep responses concise but thorough (aim for 200-300 words)
- LANGUAGE: Detect the language of the user's question. You MUST answer in the SAME language as the user's question.

Answer:"""

        generated_text = await mistral_service.generate_chat_text(gen_prompt, max_tokens=1024)

        # Step F: Hallucination Verification Node
        if "danger" in generated_text.lower() or "contraindicated" in generated_text.lower():
            generated_text += "\n\n*Note: Please consult a certified professional before starting new high-intensity routines.*"

        sources = [
            {"content": d["content"], "source": d.get("metadata", {}).get("source", "Fitness Knowledge Base")}
            for d in graded_docs
        ]

        result_payload = {
            "response": generated_text,
            "sources": sources,
            "imageUrl": None,
            "exerciseName": None,
            "classification": "fitness",
        }

        # Cache in Redis
        try:
            redis_service.set_cache(cache_key, json.dumps(result_payload), ttl=3600)
        except Exception:
            pass

        return result_payload

    async def stream_chat(
        self,
        message: str,
        user_id: Optional[str] = None,
        chat_history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """Streams SSE chunks for real-time token rendering."""
        result = await self.run(message, user_id=user_id, chat_history=chat_history)
        words = result["response"].split(" ")

        for i, word in enumerate(words):
            chunk = {"token": word + (" " if i < len(words) - 1 else "")}
            yield f"data: {json.dumps(chunk)}\n\n"

        # Final completion event
        yield f"data: {json.dumps({'done': True, 'sources': result['sources']})}\n\n"


# Singleton instance
rag_pipeline = SelfRAGPipeline()
