"""Pytest fixtures and test harnesses for ZenFit AI Engine."""

import sys
import os
import pytest
from starlette.testclient import TestClient

# Ensure ai-engine root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import create_application
from app.config import settings
from app.core.circuit_breaker import mistral_breaker, gemini_breaker, pollinations_breaker
from app.services.redis_service import redis_service
from app.services.redis_vss_service import redis_vss_service
from app.services.queue_publisher import queue_publisher


@pytest.fixture(scope="session")
def app():
    """Application instance for testing."""
    settings.ENVIRONMENT = "test"
    return create_application()


@pytest.fixture(scope="session")
def client(app):
    """Starlette / FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def reset_in_memory_state():
    """Resets memory queues, locks, and caches between test runs."""
    settings.ENVIRONMENT = "test"
    mistral_breaker.reset()
    gemini_breaker.reset()
    pollinations_breaker.reset()
    redis_service._memory_cache.clear()
    redis_vss_service._test_vectors.clear()
    queue_publisher.memory_queue.clear()
    if redis_service.client:
        try:
            for k in redis_service.client.keys("idempotency:*"):
                redis_service.client.delete(k)
        except Exception:
            pass
    yield
    redis_service._memory_cache.clear()
    redis_vss_service._test_vectors.clear()
    queue_publisher.memory_queue.clear()
    if redis_service.client:
        try:
            for k in redis_service.client.keys("idempotency:*"):
                redis_service.client.delete(k)
        except Exception:
            pass
