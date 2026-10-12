"""Quote Service for ZenFit AI Engine.
Generates motivational quotes via Mistral with Redis caching.
"""

from typing import Dict, Any, Optional
from app.core.logger import logger
from app.services.mistral_service import mistral_service
from app.services.redis_service import redis_service


class QuoteService:
    """Manages general and personalized quote generation."""

    async def get_daily_quote(self) -> Dict[str, str]:
        """Returns short motivational quote, cached for 12 hours."""
        cache_key = "quote:daily_fitness_quote"
        cached = redis_service.get_cache(cache_key)
        if cached:
            return {"quote": cached, "author": "ZenFit Coach"}

        prompt = "Generate one short original motivational quote about fitness, discipline, or self-improvement (1-2 lines max). Return only the quote, no attribution."
        quote_text = await mistral_service.generate_chat_text(
            prompt=prompt,
            system_prompt="You are a legendary strength coach.",
            max_tokens=60,
        )
        quote_text = quote_text.strip().strip('"') or "Consistency is the foundation of greatness."
        redis_service.set_cache(cache_key, quote_text, ttl=43200)
        return {"quote": quote_text, "author": "ZenFit Coach"}

    async def get_personalized_quote(self, user_profile: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
        """Generates quote tailored to client name, goal, and fitness level."""
        profile = user_profile or {}
        name = profile.get("name", "Friend")
        goal = profile.get("fitnessGoal", "Wellness")
        level = profile.get("fitnessLevel", "Beginner")

        prompt = f"""Generate a personalized, motivational fitness quote for someone with these details:
- Name: {name}
- Goal: {goal}
- Fitness Level: {level}

Create an inspiring, concise quote (1-2 lines) that specifically addresses their fitness goal and current situation. Return only the quote, no attribution."""

        quote_text = await mistral_service.generate_chat_text(
            prompt=prompt,
            system_prompt="You are an empathetic, world-class athletic trainer.",
            max_tokens=80,
        )
        quote_text = quote_text.strip().strip('"') or f"{name}, your journey toward {goal} starts with today's discipline."
        return {"quote": quote_text, "personalizedFor": name}


# Singleton instance
quote_service = QuoteService()
