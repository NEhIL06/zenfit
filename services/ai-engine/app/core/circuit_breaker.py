"""Circuit Breaker for third-party external AI APIs (Mistral, Gemini, Pollinations).
Implements Section 10.5 of ZenFit Architecture Specification.
Prevents cascading timeouts and connection exhaustion during external outages.
"""

import time
import asyncio
import inspect
from enum import Enum
from typing import Callable, Any, Optional
from app.core.logger import logger
from app.core.errors import CircuitBreakerOpenError


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Thread-safe & async-compatible circuit breaker pattern."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: float = 0.0
        self._lock = asyncio.Lock()

    def reset(self) -> None:
        """Resets the circuit breaker to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0.0

    async def can_execute(self) -> bool:
        """Determines whether a call to the external service should proceed."""
        async with self._lock:
            if self.state == CircuitState.CLOSED:
                return True

            now = time.monotonic()
            if self.state == CircuitState.OPEN:
                if now - self.last_failure_time >= self.recovery_timeout:
                    logger.info(f"[CircuitBreaker:{self.name}] Recovery timeout elapsed. Transitioning to HALF_OPEN")
                    self.state = CircuitState.HALF_OPEN
                    return True
                return False

            if self.state == CircuitState.HALF_OPEN:
                # In HALF_OPEN, allow a single probe request through
                return True

            return False

    async def record_success(self) -> None:
        """Records a successful call, resetting failure counts and closing the circuit."""
        async with self._lock:
            if self.state != CircuitState.CLOSED:
                logger.info(f"[CircuitBreaker:{self.name}] Probe succeeded! Closing circuit.")
            self.state = CircuitState.CLOSED
            self.failure_count = 0

    async def record_failure(self, error: Optional[Exception] = None) -> None:
        """Records a failed call, incrementing failures and tripping to OPEN if threshold hit."""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.monotonic()
            logger.warning(
                f"[CircuitBreaker:{self.name}] Failure #{self.failure_count}/{self.failure_threshold}. "
                f"Error: {error or 'Unknown'}"
            )

            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
                logger.error(
                    f"[CircuitBreaker:{self.name}] Threshold exceeded! Tripped to OPEN for {self.recovery_timeout}s"
                )

    async def call(self, func: Callable, *args: Any, **kwargs: Any) -> Any:
        """Executes the wrapped callable guarded by the circuit breaker."""
        if not await self.can_execute():
            raise CircuitBreakerOpenError(self.name)

        try:
            if inspect.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            await self.record_success()
            return result
        except Exception as e:
            await self.record_failure(e)
            raise


# Pre-configured instances
mistral_breaker = CircuitBreaker("Mistral", failure_threshold=5, recovery_timeout=60.0)
gemini_breaker = CircuitBreaker("Gemini", failure_threshold=5, recovery_timeout=60.0)
pollinations_breaker = CircuitBreaker("Pollinations", failure_threshold=3, recovery_timeout=30.0)
