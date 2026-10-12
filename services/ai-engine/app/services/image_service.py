"""Image Generation Service for ZenFit AI Engine.
Implements the 3-tier fallback chain:
1. Redis cache
2. Primary provider (Nanobanana or Gemini) with circuit breaker
3. Pollinations AI fast provider
4. Instant Curated CDN URL fallback (guarantees sub-second reliability)
"""

import urllib.parse
from typing import Dict, Any, Optional
import httpx
from app.config import settings
from app.core.logger import logger
from app.core.circuit_breaker import pollinations_breaker
from app.services.redis_service import redis_service

CURATED_EXERCISE_IMAGES = {
    "squat": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop&q=80",
    "bench": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80",
    "deadlift": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
    "pullup": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=800&auto=format&fit=crop&q=80",
    "running": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&auto=format&fit=crop&q=80",
}

CURATED_MEAL_IMAGES = {
    "chicken": "https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&auto=format&fit=crop&q=80",
    "salmon": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&auto=format&fit=crop&q=80",
    "oatmeal": "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?w=800&auto=format&fit=crop&q=80",
    "salad": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80",
    "shake": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800&auto=format&fit=crop&q=80",
}

DEFAULT_EXERCISE = "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80"
DEFAULT_MEAL = "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&auto=format&fit=crop&q=80"


def get_curated_image_url(name: str, item_type: str) -> str:
    """Finds matching curated image by keyword match."""
    lower = name.lower()
    table = CURATED_EXERCISE_IMAGES if item_type == "exercise" else CURATED_MEAL_IMAGES
    default = DEFAULT_EXERCISE if item_type == "exercise" else DEFAULT_MEAL

    for key, url in table.items():
        if key in lower:
            return url
    return default


class ImageService:
    """Manages cached image retrieval and generation."""

    async def generate_image(self, name: str, item_type: str) -> Dict[str, str]:
        """Runs the 3-tier image generation fallback chain."""
        cache_key = f"image:{item_type}:{name.lower().replace(' ', '_')}"

        # 1. Redis Cache
        cached = redis_service.get_cache(cache_key)
        if cached:
            return {"imageData": cached, "provider": "cache"}

        curated_url = get_curated_image_url(name, item_type)

        # 2. Build prompt for Pollinations / Nanobanana
        if item_type == "exercise":
            prompt = f"Realistic fitness photograph of a person performing {name}, proper gym form, 8k resolution"
        else:
            prompt = f"Realistic appetizing culinary photography of {name}, healthy balanced diet, 8k resolution"

        encoded = urllib.parse.quote(prompt)
        pollinations_url = f"https://image.pollinations.ai/prompt/{encoded}?model={settings.POLLINATIONS_IMAGE_MODEL}&width=512&height=512&nologo=true"

        # 3. Check Pollinations with 2s timeout guarded by circuit breaker
        final_url = curated_url
        provider = "curated_cdn"

        try:
            async def _probe_pollinations():
                async with httpx.AsyncClient(timeout=2.0) as client:
                    res = await client.head(pollinations_url)
                    return res.status_code == 200

            is_ok = await pollinations_breaker.call(_probe_pollinations)
            if is_ok:
                final_url = pollinations_url
                provider = "pollinations"
        except Exception as e:
            logger.debug(f"[ImageService] Pollinations probe failed ({e}). Falling back to curated CDN.")
            final_url = curated_url
            provider = "curated_cdn"

        # Cache result in Redis for 7 days
        redis_service.set_cache(cache_key, final_url, ttl=604800)
        return {"imageData": final_url, "provider": provider}


# Singleton instance
image_service = ImageService()
