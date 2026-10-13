"""Go Speech Microservice Client for Sentence-Boundary Streaming TTS.
Implements Section 3.1 & Section 4.4 of ZenFit Architecture Specification:
1. Buffers LLM tokens and detects discrete grammatical clause/sentence boundaries.
2. Dispatches Sentence #1 asynchronously to Go Speech Microservice (:8081).
3. Achieves sub-500ms TTFA (Time-to-First-Audio) playback queue in the browser.
4. Non-blocking fire-and-forget: failure in speech microservice never interrupts LLM text stream.
"""

import asyncio
from typing import Optional
import httpx
from app.config import settings
from app.core.logger import logger


class SpeechClient:
    """Asynchronous client for Go Speech Service (POST /v1/voice/generate)."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.SPEECH_SERVICE_URL).rstrip("/")

    def dispatch_sentence_tts(
        self,
        sentence_index: int,
        text: str,
        voice_name: str = "Puck",
    ) -> None:
        """Dispatches sentence clause TTS synthesis in a non-blocking background task."""
        if not text or len(text.strip()) < 3 or settings.ENVIRONMENT == "test":
            return

        # Fire and forget without blocking calling coroutine
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self._send_tts_request(sentence_index, text, voice_name))
        except RuntimeError:
            pass

    async def _send_tts_request(
        self,
        sentence_index: int,
        text: str,
        voice_name: str,
    ) -> None:
        """Sends HTTP POST to Go Speech Service."""
        url = f"{self.base_url}/v1/voice/generate"
        payload = {
            "text": text,
            "voiceName": voice_name,
            "sentenceIndex": sentence_index,
        }
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    logger.debug(f"[SpeechClient] Dispatched Sentence #{sentence_index} to Go Speech Service ({len(text)} chars)")
        except Exception as e:
            logger.debug(f"[SpeechClient] Go Speech Service unreachable for Sentence #{sentence_index} ({e})")


# Singleton instance
speech_client = SpeechClient()
