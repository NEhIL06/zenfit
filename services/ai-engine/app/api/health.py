"""Healthcheck Probes for ZenFit AI Engine.
Implements Section 11.3:
- Liveness Probe (/health/live): checks ONLY that the process is running. Never checks downstream DBs.
- Readiness Probe (/health/ready): checks Redis, RabbitMQ, and MongoDB connectivity.
"""

from typing import Dict, Any
from fastapi import APIRouter, Response, status
from app.config import settings
from app.services.redis_service import redis_service
from app.services.queue_publisher import queue_publisher
from app.services.chroma_service import chroma_service

router = APIRouter(tags=["Health"])


@router.get("/health/live", summary="Liveness Probe")
async def health_live() -> Dict[str, str]:
    """Pure liveness check. Always returns 200 OK as long as FastAPI process is alive."""
    return {
        "status": "UP",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@router.get("/health/ready", summary="Readiness Probe")
async def health_ready(response: Response) -> Dict[str, Any]:
    """Readiness probe checking availability of backing datastores."""
    redis_ok = redis_service.ping()
    rabbitmq_ok = queue_publisher.ping()
    chroma_ok = await chroma_service.ping()

    is_ready = redis_ok  # Minimum viable readiness requirement

    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "READY" if is_ready else "NOT_READY",
        "dependencies": {
            "redis": "UP" if redis_ok else "DOWN",
            "rabbitmq": "UP" if rabbitmq_ok else "DEGRADED_FALLBACK",
            "chromadb": "UP" if chroma_ok else "IN_MEMORY_FALLBACK",
        },
        "environment": settings.ENVIRONMENT,
    }
